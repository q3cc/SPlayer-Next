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
        }
    }
}
