# Qeemat
Tool to keep track of prices

## MVP

Qeemat is a local-first Android app built with bare React Native and TypeScript. The MVP stores tracked products and price history on-device and supports manual price checks for selected stores.

Supported MVP stores:

- Noon UAE
- Nike UAE
- Sun & Sand Sports UAE
- Level Shoes
- Amazon.ae

## Planning

- [MVP scope](docs/mvp-scope.md)
- [Local-only MVP plan](docs/local-only-mvp-plan.md)

## Development

```bash
npm install
npm run start
```

Open the `android/` folder in Android Studio to sync, build, and run on a physical Android device.

Useful checks:

```bash
npm run typecheck
npm run lint
```

Run on a connected Android phone from the terminal:

```bash
npm run android:device
```

If Gradle reports an invalid `JAVA_HOME`, set Android Studio's Gradle JDK or update the terminal `JAVA_HOME` to a valid JDK 17+ installation.
