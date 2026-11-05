// Saves / shares files the web app builds in the page (procurement .xlsx).
// WKWebView is unreliable with blob downloads and the Web Share API, so the
// page sends the bytes over the bridge (SHARE_FILES / SAVE_FILES) and this
// module writes them under their real names and opens the system UI.
// JS side: mobile/src/lib/nativeFiles.ts. Android: files/XFileShareModule.kt.
//   share(files, title) -> "shared" | "cancelled"
//   save(files, title)  -> "saved" | "cancelled" ("shared" below iOS 14)
// `title` names the Android chooser; iOS sheets have no title to set.
// Failures reject with code E_FILES. Classic module; works through the
// new-architecture interop layer.

#import <React/RCTBridgeModule.h>
#import <React/RCTUtils.h>
#import <UIKit/UIKit.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

static NSString *const XFileShareError = @"E_FILES";
static NSString *const XFileShareDir = @"xmobile-files";
static const NSUInteger XFileShareMaxNameLength = 120;

@interface XFileShare : NSObject <RCTBridgeModule, UIDocumentPickerDelegate>
@end

@implementation XFileShare {
  // One sheet at a time; the promise stays here until the user closes it.
  RCTPromiseResolveBlock _resolve;
  RCTPromiseRejectBlock _reject;
  // Strong ref: UIDocumentPickerViewController.delegate is weak.
  UIDocumentPickerViewController *_picker;
  // Whatever is on screen for the pending promise (picker or share sheet).
  __weak UIViewController *_sheet;
}

RCT_EXPORT_MODULE(XFileShare)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

RCT_EXPORT_METHOD(share
                  : (NSArray *)files title
                  : (NSString *)title resolve
                  : (RCTPromiseResolveBlock)resolve reject
                  : (RCTPromiseRejectBlock)reject)
{
  [self run:NO files:files title:title resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(save
                  : (NSArray *)files title
                  : (NSString *)title resolve
                  : (RCTPromiseResolveBlock)resolve reject
                  : (RCTPromiseRejectBlock)reject)
{
  [self run:YES files:files title:title resolve:resolve reject:reject];
}

#pragma mark - Flow

- (void)run:(BOOL)save
      files:(NSArray *)files
      title:(NSString *)title
    resolve:(RCTPromiseResolveBlock)resolve
     reject:(RCTPromiseRejectBlock)reject
{
  if (_resolve != nil) {
    if (_sheet != nil && _sheet.presentingViewController != nil) {
      reject(XFileShareError, @"busy", nil);
      return;
    }
    // The sheet went away without telling us (e.g. dismissed by the system):
    // settle the old promise instead of staying busy forever.
    [self finish:@"cancelled"];
  }

  NSError *error = nil;
  NSArray<NSURL *> *urls = [self writeFiles:files error:&error];
  if (urls == nil) {
    reject(XFileShareError, error.localizedDescription ?: @"could not write files", error);
    return;
  }

  UIViewController *presenter = [self topViewController];
  if (presenter == nil) {
    reject(XFileShareError, @"no view controller to present from", nil);
    return;
  }

  _resolve = resolve;
  _reject = reject;

  if (save) {
    if (@available(iOS 14.0, *)) {
      UIDocumentPickerViewController *picker =
          [[UIDocumentPickerViewController alloc] initForExportingURLs:urls asCopy:YES];
      picker.delegate = self;
      picker.modalPresentationStyle = UIModalPresentationFormSheet;
      _picker = picker;
      _sheet = picker;
      [presenter presentViewController:picker animated:YES completion:nil];
      return;
    }
  }
  [self presentShare:urls from:presenter];
}

- (void)presentShare:(NSArray<NSURL *> *)urls from:(UIViewController *)presenter
{
  UIActivityViewController *sheet = [[UIActivityViewController alloc] initWithActivityItems:urls
                                                                      applicationActivities:nil];
  __weak XFileShare *weakSelf = self;
  sheet.completionWithItemsHandler =
      ^(UIActivityType activityType, BOOL completed, NSArray *returnedItems, NSError *activityError) {
        XFileShare *strongSelf = weakSelf;
        if (strongSelf == nil) {
          return;
        }
        if (activityError != nil) {
          [strongSelf finishWithError:activityError.localizedDescription ?: @"share failed"];
        } else {
          [strongSelf finish:completed ? @"shared" : @"cancelled"];
        }
      };

  UIPopoverPresentationController *popover = sheet.popoverPresentationController;
  if (popover != nil) {
    UIView *anchor = presenter.view;
    popover.sourceView = anchor;
    popover.sourceRect = CGRectMake(CGRectGetMidX(anchor.bounds), CGRectGetMidY(anchor.bounds), 0, 0);
    popover.permittedArrowDirections = 0;
  }
  _sheet = sheet;
  [presenter presentViewController:sheet animated:YES completion:nil];
}

- (void)finish:(NSString *)status
{
  RCTPromiseResolveBlock resolve = _resolve;
  [self clearPending];
  if (resolve != nil) {
    resolve(status);
  }
}

- (void)finishWithError:(NSString *)message
{
  RCTPromiseRejectBlock reject = _reject;
  [self clearPending];
  if (reject != nil) {
    reject(XFileShareError, message, nil);
  }
}

- (void)clearPending
{
  _resolve = nil;
  _reject = nil;
  _picker.delegate = nil;
  _picker = nil;
  _sheet = nil;
}

#pragma mark - UIDocumentPickerDelegate

- (void)documentPicker:(UIDocumentPickerViewController *)controller
    didPickDocumentsAtURLs:(NSArray<NSURL *> *)urls
{
  [self finish:@"saved"];
}

- (void)documentPickerWasCancelled:(UIDocumentPickerViewController *)controller
{
  [self finish:@"cancelled"];
}

#pragma mark - Files

- (NSArray<NSURL *> *)writeFiles:(NSArray *)files error:(NSError **)error
{
  if (![files isKindOfClass:[NSArray class]] || files.count == 0) {
    *error = [self errorWithMessage:@"no files"];
    return nil;
  }

  NSFileManager *fm = [NSFileManager defaultManager];
  NSString *root = [NSTemporaryDirectory() stringByAppendingPathComponent:XFileShareDir];
  [self cleanupRoot:root];

  // One folder per request, so the receiving app sees the real file name
  // without two stores' files colliding.
  NSString *dir = [root stringByAppendingPathComponent:[NSUUID UUID].UUIDString];
  if (![fm createDirectoryAtPath:dir withIntermediateDirectories:YES attributes:nil error:error]) {
    return nil;
  }

  NSMutableArray<NSURL *> *urls = [NSMutableArray arrayWithCapacity:files.count];
  NSMutableSet<NSString *> *used = [NSMutableSet set];
  for (NSUInteger i = 0; i < files.count; i++) {
    NSDictionary *file = files[i];
    if (![file isKindOfClass:[NSDictionary class]]) {
      *error = [self errorWithMessage:[NSString stringWithFormat:@"file %lu missing", (unsigned long)i]];
      return nil;
    }
    NSString *rawName = [file[@"name"] isKindOfClass:[NSString class]] ? file[@"name"] : @"";
    NSString *name = [self uniqueName:[XFileShare sanitize:rawName] used:used];
    NSString *base64 = [file[@"base64"] isKindOfClass:[NSString class]] ? file[@"base64"] : @"";
    NSData *data = [[NSData alloc] initWithBase64EncodedString:base64
                                                       options:NSDataBase64DecodingIgnoreUnknownCharacters];
    if (data == nil || data.length == 0) {
      *error = [self errorWithMessage:[NSString stringWithFormat:@"file %@ is empty or not base64", name]];
      return nil;
    }
    NSString *path = [dir stringByAppendingPathComponent:name];
    if (![data writeToFile:path options:NSDataWritingAtomic error:error]) {
      return nil;
    }
    [urls addObject:[NSURL fileURLWithPath:path]];
  }
  return urls;
}

/** Two files with the same name in one request would overwrite each other. */
- (NSString *)uniqueName:(NSString *)name used:(NSMutableSet<NSString *> *)used
{
  NSString *candidate = name;
  NSString *ext = name.pathExtension;
  NSString *stem = name.stringByDeletingPathExtension;
  for (NSUInteger n = 2; [used containsObject:candidate.lowercaseString]; n++) {
    candidate = ext.length > 0 ? [NSString stringWithFormat:@"%@ (%lu).%@", stem, (unsigned long)n, ext]
                               : [NSString stringWithFormat:@"%@ (%lu)", stem, (unsigned long)n];
  }
  [used addObject:candidate.lowercaseString];
  return candidate;
}

/** Drops request folders older than a day; shared files must outlive the sheet. */
- (void)cleanupRoot:(NSString *)root
{
  NSFileManager *fm = [NSFileManager defaultManager];
  NSDate *cutoff = [NSDate dateWithTimeIntervalSinceNow:-24 * 60 * 60];
  for (NSString *entry in [fm contentsOfDirectoryAtPath:root error:nil] ?: @[]) {
    NSString *path = [root stringByAppendingPathComponent:entry];
    NSDate *modified = [fm attributesOfItemAtPath:path error:nil][NSFileModificationDate];
    if (modified != nil && [modified compare:cutoff] == NSOrderedAscending) {
      [fm removeItemAtPath:path error:nil];
    }
  }
}

+ (NSString *)sanitize:(NSString *)raw
{
  NSMutableCharacterSet *bad = [NSMutableCharacterSet characterSetWithCharactersInString:@"/\\:*?\"<>|"];
  [bad formUnionWithCharacterSet:[NSCharacterSet controlCharacterSet]];
  NSString *cleaned = [[raw componentsSeparatedByCharactersInSet:bad] componentsJoinedByString:@"_"];
  cleaned = [cleaned stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
  // No hidden files.
  while ([cleaned hasPrefix:@"."]) {
    cleaned = [cleaned substringFromIndex:1];
  }
  if (cleaned.length > XFileShareMaxNameLength) {
    // Cut before the character that crosses the limit (no half emoji).
    NSRange cut = [cleaned rangeOfComposedCharacterSequenceAtIndex:XFileShareMaxNameLength];
    cleaned = [cleaned substringToIndex:cut.location];
  }
  return cleaned.length > 0 ? cleaned : @"file";
}

- (NSError *)errorWithMessage:(NSString *)message
{
  return [NSError errorWithDomain:@"XFileShare" code:1 userInfo:@{NSLocalizedDescriptionKey : message}];
}

#pragma mark - Presentation

- (UIViewController *)topViewController
{
  UIViewController *controller = RCTKeyWindow().rootViewController;
  if (controller == nil) {
    controller = RCTPresentedViewController();
  }
  while (controller.presentedViewController != nil && !controller.presentedViewController.isBeingDismissed) {
    controller = controller.presentedViewController;
  }
  return controller;
}

@end
