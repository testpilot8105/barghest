import type { PropertyDef as $PropertyDef } from '@osdk/client';
import { $osdkMetadata } from '../../OntologyMetadata.js';
import type { $ExpectedClientVersion } from '../../OntologyMetadata.js';
import type { Passage } from './Passage.js';
import type { SourceRecord } from './SourceRecord.js';
import type {
  PropertyKeys as $PropertyKeys,
  ObjectTypeDefinition as $ObjectTypeDefinition,
  ObjectMetadata as $ObjectMetadata,
} from '@osdk/client';
import type {
  ObjectSet as $ObjectSet,
  Osdk as $Osdk,
  OsdkObject as $OsdkObject,
  PropertyValueWireToClient as $PropType,
  SingleLinkAccessor as $SingleLinkAccessor,
} from '@osdk/client';

export namespace Document {
  export type PropertyKeys =
    | 'documentId'
    | 'format'
    | 'importedAt'
    | 'path'
    | 'scenario'
    | 'status'
    | 'system'
    | 'title';

  export interface Links {
    readonly passages: Passage.ObjectSet;
    readonly records: SourceRecord.ObjectSet;
  }

  export interface Props {
    /**
     *   property status: active
     *
     *   display name: 'Document id'
     */
    readonly documentId: $PropType['string'];
    /**
     *   property status: active
     *
     *   display name: 'Format'
     */
    readonly format: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Imported at'
     */
    readonly importedAt: $PropType['timestamp'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Path'
     */
    readonly path: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Investigation'
     */
    readonly scenario: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Status'
     */
    readonly status: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Source system'
     */
    readonly system: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Title'
     */
    readonly title: $PropType['string'] | undefined;
  }
  export type StrictProps = Props;

  export interface ObjectSet extends $ObjectSet<Document, Document.ObjectSet> {}

  export type OsdkInstance<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Document.Props = keyof Document.Props,
  > = $Osdk.Instance<Document, OPTIONS, K>;

  /** @deprecated use OsdkInstance */
  export type OsdkObject<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Document.Props = keyof Document.Props,
  > = OsdkInstance<OPTIONS, K>;
}

export interface Document extends $ObjectTypeDefinition {
  osdkMetadata: typeof $osdkMetadata;
  type: 'object';
  apiName: 'Document';
  primaryKeyApiName: 'documentId';
  primaryKeyType: 'string';
  __DefinitionMetadata?: {
    objectSet: Document.ObjectSet;
    props: Document.Props;
    linksType: Document.Links;
    strictProps: Document.StrictProps;
    apiName: 'Document';
    description: undefined;
    displayName: 'Document';
    icon: {
      type: 'blueprint';
      color: '#2D72D2';
      name: 'cube';
    };
    implements: [];
    interfaceMap: {};
    inverseInterfaceMap: {};
    links: {
      passages: $ObjectMetadata.Link<Passage, true>;
      records: $ObjectMetadata.Link<SourceRecord, true>;
    };
    pluralDisplayName: 'Documents';
    primaryKeyApiName: 'documentId';
    primaryKeyType: 'string';
    properties: {
      /**
       *   property status: active
       *
       *   display name: 'Document id'
       */
      documentId: $PropertyDef<'string', 'non-nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Format'
       */
      format: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Imported at'
       */
      importedAt: $PropertyDef<'timestamp', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Path'
       */
      path: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Investigation'
       */
      scenario: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Status'
       */
      status: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Source system'
       */
      system: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Title'
       */
      title: $PropertyDef<'string', 'nullable', 'single'>;
    };
    rid: 'ri.Document';
    status: 'ACTIVE';
    titleProperty: 'title';
    type: 'object';
    visibility: undefined;
  };
}

export const Document = {
  type: 'object',
  apiName: 'Document',
  osdkMetadata: $osdkMetadata,
  primaryKeyApiName: 'documentId',
  primaryKeyType: 'string',
  internalDoNotUseMetadata: {
    rid: 'ri.Document',
  },
} satisfies Document & { internalDoNotUseMetadata: { rid: string } } as Document;
