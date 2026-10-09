// The Object Explorer data layer: the only path the screens import. Plain functions for the reads, hooks for the
// screens, the exploration helpers for the address bar. Nothing from @osdk crosses this line.
export type * from './types.ts';
export { connect, type DataClient } from './client.ts';
export { buildCatalog, linkOf, propertyOf } from './catalog.ts';
export { currentType, decodeExploration, encodeExploration, startExploration, typeAt, withStep } from './exploration.ts';
export { countRows, fetchRows, getObjectView, histogram, searchAll, searchAround, toRefs, toWhere } from './reads.ts';
export {
  BarghestDataProvider,
  useAsync,
  useCatalog,
  useCount,
  useDataClient,
  useHistogram,
  useObjectView,
  useRows,
  useSearchAll,
  useSearchAround,
  type AsyncState,
  type RowsState,
} from './hooks.tsx';
