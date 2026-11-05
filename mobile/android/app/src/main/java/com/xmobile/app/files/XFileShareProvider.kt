package com.xmobile.app.files

import androidx.core.content.FileProvider

/**
 * Own subclass so this <provider> never merges with another library's
 * androidx FileProvider entry (the manifest merger keys providers by class).
 */
class XFileShareProvider : FileProvider()
