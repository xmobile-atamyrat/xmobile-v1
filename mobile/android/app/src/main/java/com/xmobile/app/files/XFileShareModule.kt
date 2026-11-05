package com.xmobile.app.files

import android.content.ClipData
import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import java.io.File
import java.util.UUID

/**
 * Saves / shares files the web app builds in the page (procurement .xlsx).
 * Android WebView ignores blob downloads and has no Web Share API, so the page
 * sends the bytes over the bridge and this module does the work.
 * Contract: scratchpad NATIVE_FILES.md — share() -> "shared", save() -> "saved"
 * (or "shared" on API < 29, where it falls back to the share sheet).
 */
class XFileShareModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = NAME

  private data class Item(val name: String, val mimeType: String, val bytes: ByteArray)

  @ReactMethod
  fun share(files: ReadableArray, title: String?, promise: Promise) {
    try {
      val items = decode(files)
      startShare(writeToCache(items), items, title)
      promise.resolve("shared")
    } catch (e: Exception) {
      promise.reject(ERROR, e.message ?: "share failed", e)
    }
  }

  @ReactMethod
  fun save(files: ReadableArray, title: String?, promise: Promise) {
    try {
      val items = decode(files)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        items.forEach { saveToDownloads(it) }
        promise.resolve("saved")
      } else {
        // Writing to public Downloads below Android 10 needs a storage
        // permission; the share sheet ("Save to Drive", Files, …) doesn't.
        startShare(writeToCache(items), items, title)
        promise.resolve("shared")
      }
    } catch (e: Exception) {
      promise.reject(ERROR, e.message ?: "save failed", e)
    }
  }

  private fun decode(files: ReadableArray): List<Item> {
    require(files.size() > 0) { "no files" }
    return (0 until files.size()).map { i ->
      val file = files.getMap(i) ?: throw IllegalArgumentException("file $i missing")
      val name = sanitize(file.getString("name") ?: "")
      val mime = file.getString("mimeType")?.takeIf { it.isNotBlank() }
        ?: "application/octet-stream"
      val bytes = Base64.decode(file.getString("base64") ?: "", Base64.DEFAULT)
      require(bytes.isNotEmpty()) { "file $name is empty" }
      Item(name, mime, bytes)
    }
  }

  private fun writeToCache(items: List<Item>): List<Uri> {
    val root = File(reactContext.cacheDir, DIR)
    cleanup(root)
    // One folder per request, so the receiving app sees the real file name
    // without two stores' files colliding.
    val dir = File(root, UUID.randomUUID().toString()).apply { mkdirs() }
    val authority = "${reactContext.packageName}.xfileshare"
    val used = mutableSetOf<String>()
    return items.map { item ->
      val file = File(dir, uniqueName(item.name, used))
      file.writeBytes(item.bytes)
      FileProvider.getUriForFile(reactContext, authority, file)
    }
  }

  private fun startShare(uris: List<Uri>, items: List<Item>, title: String?) {
    val mimes = items.map { it.mimeType }.distinct()
    val intent = if (uris.size == 1) {
      Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_STREAM, uris[0])
    } else {
      Intent(Intent.ACTION_SEND_MULTIPLE)
        .putParcelableArrayListExtra(Intent.EXTRA_STREAM, ArrayList(uris))
    }
    intent.type = if (mimes.size == 1) mimes[0] else "*/*"
    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    // ClipData is what actually carries the read grant to the chosen app.
    intent.clipData = ClipData.newRawUri(null, uris[0]).also { clip ->
      uris.drop(1).forEach { clip.addItem(ClipData.Item(it)) }
    }
    if (!title.isNullOrBlank()) intent.putExtra(Intent.EXTRA_SUBJECT, title)

    val chooser = Intent.createChooser(intent, title)
      .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    val activity = reactContext.currentActivity
    if (activity != null) {
      activity.runOnUiThread { activity.startActivity(chooser) }
    } else {
      reactContext.startActivity(chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }

  @androidx.annotation.RequiresApi(Build.VERSION_CODES.Q)
  private fun saveToDownloads(item: Item) {
    val resolver = reactContext.contentResolver
    val values = ContentValues().apply {
      put(MediaStore.Downloads.DISPLAY_NAME, item.name)
      put(MediaStore.Downloads.MIME_TYPE, item.mimeType)
      put(MediaStore.Downloads.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/Xmobile")
      put(MediaStore.Downloads.IS_PENDING, 1)
    }
    val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
      ?: throw IllegalStateException("could not create ${item.name} in Downloads")
    try {
      resolver.openOutputStream(uri)?.use { it.write(item.bytes) }
        ?: throw IllegalStateException("could not write ${item.name}")
      values.clear()
      values.put(MediaStore.Downloads.IS_PENDING, 0)
      resolver.update(uri, values, null, null)
    } catch (e: Exception) {
      resolver.delete(uri, null, null)
      throw e
    }
  }

  /** Drops request folders older than a day; shared files must outlive the chooser. */
  private fun cleanup(root: File) {
    val cutoff = System.currentTimeMillis() - 24 * 60 * 60 * 1000L
    root.listFiles()?.filter { it.lastModified() < cutoff }?.forEach { it.deleteRecursively() }
  }

  companion object {
    const val NAME = "XFileShare"
    private const val ERROR = "E_FILES"
    private const val DIR = "xmobile-files"

    /** Two files with the same name in one request would overwrite each other. */
    fun uniqueName(name: String, used: MutableSet<String>): String {
      val dot = name.lastIndexOf('.')
      val stem = if (dot > 0) name.substring(0, dot) else name
      val ext = if (dot > 0) name.substring(dot) else ""
      var candidate = name
      var n = 2
      while (!used.add(candidate.lowercase())) {
        candidate = "$stem ($n)$ext"
        n += 1
      }
      return candidate
    }

    fun sanitize(raw: String): String {
      val cleaned = raw
        .replace(Regex("[/\\\\:*?\"<>|\\p{Cntrl}]"), "_")
        .trim()
        .trimStart('.')
        .take(120)
      return cleaned.ifEmpty { "file" }
    }
  }
}
