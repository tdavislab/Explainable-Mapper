# Zustand store

Application state lives in `useAppStore.js`.

Main domains:
- dataset / layer / layout
- legend + L2 range
- selection / comparison
- perturbation trajectory sentences and flags
- mapper / projection update signals
- loading flags

Async helpers:
- `fetchInitialData()` — first load after mount
- `fetchDataOnSwitch()` — reload after dataset/layer-driven refresh
