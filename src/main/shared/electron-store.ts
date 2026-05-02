import * as ElectronStore from 'electron-store'

type StoreOptions = ConstructorParameters<typeof ElectronStore.default>[0]
type ElectronStoreConstructor = new (options?: StoreOptions) => ElectronStore.default
type ElectronStoreModule = {
  default?: ElectronStoreConstructor | ElectronStoreModule
}

export function getElectronStoreConstructor(): ElectronStoreConstructor {
  const storeModule = ElectronStore as unknown as ElectronStoreModule | ElectronStoreConstructor

  if (typeof storeModule === 'function') {
    return storeModule
  }

  if (typeof storeModule.default === 'function') {
    return storeModule.default
  }

  if (storeModule.default && typeof storeModule.default.default === 'function') {
    return storeModule.default.default
  }

  throw new TypeError('electron-store constructor is unavailable')
}
