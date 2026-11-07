# Putting Hammer & Delgado on the App Store (iPhone + iPad)

The game is wrapped as a native app with **Capacitor**. The Xcode project lives in `ios/`. The app's contents are one self-contained file (`www/index.html`) that `npm run build` produces from the same code as the web version, so every web update can become an app update.

## 1. Build it on your Mac (about 10 minutes)

You need **Node.js** (if `npm` isn't found in Terminal, install the LTS version from nodejs.org) and **Xcode**.

In Terminal:

```bash
git clone https://github.com/nealrosenblat/Hunter.git   # first time only
cd Hunter
git checkout claude/elegant-planck-zfw98s
git pull                                                 # every time after that

npm install          # tools (first time, or when package.json changes)
npm run build        # makes www/index.html from the game code
npx cap sync ios     # copies it into the Xcode project
npx cap open ios     # opens Xcode
```

The first time Xcode opens the project, it downloads the Capacitor package. Wait for "Resolving packages" to finish.

## 2. Run it on your iPhone or iPad

1. In Xcode's left sidebar, click **App** (the blue icon at the top), then the **App** target, then **Signing & Capabilities**.
2. Tick **Automatically manage signing** and choose your developer account under **Team**.
   - The bundle ID is `com.nealrosenblat.hammerdelgado`. If Xcode says it's taken or you want a different one, change it here and in `capacitor.config.json`.
3. Plug in your iPhone (or iPad), unlock it, choose it in the device menu at the top of Xcode, and press **▶ Run**.
   - First time only: on the phone, go to **Settings → Privacy & Security → Developer Mode**, turn it on and restart.

**Check on the device:**
- [ ] It opens in landscape, full screen, with no status bar.
- [ ] Sound plays. *The game respects the silent switch, so flip it off if you hear nothing.*
- [ ] Touch controls work in the chase, the warehouse, and the aerobics class.
- [ ] Swiping up from the bottom edge while steering doesn't throw you out of the game (the first swipe only shows the home bar).
- [ ] Quitting and reopening shows CONTINUE.
- [ ] (Optional) A Bluetooth game controller works.

## 3. Upload a build

1. In [App Store Connect](https://appstoreconnect.apple.com): **Apps → + → New App**.
   - Platform: iOS. Name: **Hammer & Delgado**. Language: English (U.S.). Bundle ID: the one above. SKU: `hammer-delgado-1`.
2. In Xcode, choose **Any iOS Device (arm64)** as the destination, then **Product → Archive**.
3. When the Organizer window opens: **Distribute App → App Store Connect → Upload**, accepting the defaults.
4. After 10–30 minutes the build appears under **TestFlight**. Add yourself (and family) as internal testers, then install the **TestFlight** app on your iPhone and iPad to play the real build.

Each new upload needs a higher build number: in Xcode, target **App → General → Build** (1, 2, 3…). Change **Version** (1.0, 1.1…) for public updates.

## 4. Fill in the listing and submit

Copy the text from [`listing.md`](listing.md). Then:

- **Screenshots:** drag `screenshots/iphone-*.jpg` into the **6.9" iPhone** slot and `screenshots/ipad-*.jpg` into the **13" iPad** slot. They are already the exact sizes Apple asks for (2868×1320 and 2752×2064).
- **App Privacy:** answer **"No, we do not collect data from this app."**
- **Privacy Policy URL:** `https://nealrosenblat.github.io/Hunter/privacy.html` (served by your GitHub Pages site).
- **Age Rating:** answer the questionnaire honestly. The game has frequent cartoon-style gun violence and references to crimes, including a murder. Expect a teen rating.
- **Pricing:** Free (or a price, if you want).
- Choose the build you uploaded, then **Add for Review → Submit**.

Review usually takes a day or two. If Apple pushes back, paste their message into a session and we'll fix it.
