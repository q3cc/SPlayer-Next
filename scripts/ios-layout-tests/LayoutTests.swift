import XCTest

final class LayoutTests: XCTestCase {
    func testIPadRotation() {
        let app = XCUIApplication(bundleIdentifier: "top.imsyy.splayer-next.ios")
        app.activate()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 30))
        for (orientation, name) in [
            (UIDeviceOrientation.landscapeLeft, "ipad-landscape"),
            (UIDeviceOrientation.portrait, "ipad-portrait")
        ] {
            XCUIDevice.shared.orientation = orientation
            let landscape = orientation == .landscapeLeft
            let rotated = NSPredicate { _, _ in
                let frame = app.webViews.firstMatch.frame
                return frame.width > 0 && (landscape ? frame.width > frame.height : frame.height > frame.width)
            }
            expectation(for: rotated, evaluatedWith: app)
            waitForExpectations(timeout: 15)
            let attachment = XCTAttachment(screenshot: app.screenshot())
            attachment.name = name
            attachment.lifetime = .keepAlways
            add(attachment)
            let openPlayer = app.buttons["Open test player"]
            XCTAssertTrue(openPlayer.waitForExistence(timeout: 30))
            openPlayer.tap()
            let closePlayer = app.buttons["Close test player"]
            XCTAssertTrue(closePlayer.waitForExistence(timeout: 15))
            let playerAttachment = XCTAttachment(screenshot: app.screenshot())
            playerAttachment.name = name + "-player"
            playerAttachment.lifetime = .keepAlways
            add(playerAttachment)
            closePlayer.tap()
        }
    }

    func testFolderPicker() {
        let app = XCUIApplication(bundleIdentifier: "top.imsyy.splayer-next.ios")
        app.activate()
        XCUIDevice.shared.orientation = .landscapeLeft
        let addFolder = app.buttons["Open test folder picker"]
        XCTAssertTrue(addFolder.waitForExistence(timeout: 30))
        addFolder.tap()
        let cancel = app.buttons.matching(NSPredicate(format: "label == 'Cancel' OR label == '取消'")).firstMatch
        XCTAssertTrue(cancel.waitForExistence(timeout: 15))
        let pickerAttachment = XCTAttachment(screenshot: app.screenshot())
        pickerAttachment.name = "ios-folder-picker"
        pickerAttachment.lifetime = .keepAlways
        add(pickerAttachment)
        cancel.tap()
    }
}
