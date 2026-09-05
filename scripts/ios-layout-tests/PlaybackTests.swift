import XCTest

final class PlaybackTests: XCTestCase {
    private func capture(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testSenbonzakuraPlaybackAndPiP() {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "top.imsyy.splayer-next.ios")
        app.launch()
        XCUIDevice.shared.orientation = .landscapeLeft
        let play = app.buttons["Play Senbonzakura test"]
        XCTAssertTrue(play.waitForExistence(timeout: 45))
        play.tap()
        XCTAssertTrue(app.staticTexts["Song playback verified"].waitForExistence(timeout: 150))
        capture("01-song-playing")
        app.buttons["Open lyric PiP test"].tap()
        XCTAssertTrue(app.staticTexts["Lyric PiP opened"].waitForExistence(timeout: 20))
        sleep(3)
        capture("02-pip-foreground")
        XCUIDevice.shared.press(.home)
        sleep(8)
        capture("03-pip-home")
        sleep(25)
        capture("04-pip-home-later")
        app.activate()
        app.buttons["Verify pause resume test"].tap()
        XCTAssertTrue(app.staticTexts["Pause resume verified"].waitForExistence(timeout: 20))
        capture("05-pip-resumed")
        app.buttons["Close lyric PiP test"].tap()
        XCTAssertTrue(app.staticTexts["Playback test complete"].waitForExistence(timeout: 15))
        capture("06-pip-closed")
    }
}
