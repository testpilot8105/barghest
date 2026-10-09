import type { PropertyDef as $PropertyDef } from '@osdk/client';
import { $osdkMetadata } from '../../OntologyMetadata.js';
import type { $ExpectedClientVersion } from '../../OntologyMetadata.js';
import type { LGU } from './LGU.js';
import type { Complaint } from './Complaint.js';
import type { Passage } from './Passage.js';
import type { SourceRecord } from './SourceRecord.js';
import type { Relationship } from './Relationship.js';
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

export namespace Barangay {
  export type PropertyKeys = 'barangayId' | 'canonicalId' | 'lguId' | 'name' | 'passageId' | 'recordId' | 'scenario';

  export interface Links {
    readonly candidates: Barangay.ObjectSet;
    readonly canonical: $SingleLinkAccessor<Barangay>;
    readonly complaints: Complaint.ObjectSet;
    readonly lgu: $SingleLinkAccessor<LGU>;
    readonly passage: $SingleLinkAccessor<Passage>;
    readonly relationshipsFrom: Relationship.ObjectSet;
    readonly relationshipsTo: Relationship.ObjectSet;
    readonly sourceRecord: $SingleLinkAccessor<SourceRecord>;
  }

  export interface Props {
    /**
     *   property status: active
     *
     *   display name: 'Barangay id'
     */
    readonly barangayId: $PropType['string'];
    /**
     *   property status: active
     *
     *   display name: 'Canonical object'
     */
    readonly canonicalId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'LGU'
     */
    readonly lguId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Name'
     */
    readonly name: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Passage'
     */
    readonly passageId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Source record'
     */
    readonly recordId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Investigation'
     */
    readonly scenario: $PropType['string'] | undefined;
  }
  export type StrictProps = Props;

  export interface ObjectSet extends $ObjectSet<Barangay, Barangay.ObjectSet> {}

  export type OsdkInstance<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Barangay.Props = keyof Barangay.Props,
  > = $Osdk.Instance<Barangay, OPTIONS, K>;

  /** @deprecated use OsdkInstance */
  export type OsdkObject<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Barangay.Props = keyof Barangay.Props,
  > = OsdkInstance<OPTIONS, K>;
}

export interface Barangay extends $ObjectTypeDefinition {
  osdkMetadata: typeof $osdkMetadata;
  type: 'object';
  apiName: 'Barangay';
  primaryKeyApiName: 'barangayId';
  primaryKeyType: 'string';
  __DefinitionMetadata?: {
    objectSet: Barangay.ObjectSet;
    props: Barangay.Props;
    linksType: Barangay.Links;
    strictProps: Barangay.StrictProps;
    apiName: 'Barangay';
    description: undefined;
    displayName: 'Barangay';
    icon: {
      type: 'blueprint';
      color: '#2D72D2';
      name: 'cube';
    };
    implements: [];
    interfaceMap: {};
    inverseInterfaceMap: {};
    links: {
      candidates: $ObjectMetadata.Link<Barangay, true>;
      canonical: $ObjectMetadata.Link<Barangay, false>;
      complaints: $ObjectMetadata.Link<Complaint, true>;
      lgu: $ObjectMetadata.Link<LGU, false>;
      passage: $ObjectMetadata.Link<Passage, false>;
      relationshipsFrom: $ObjectMetadata.Link<Relationship, true>;
      relationshipsTo: $ObjectMetadata.Link<Relationship, true>;
      sourceRecord: $ObjectMetadata.Link<SourceRecord, false>;
    };
    pluralDisplayName: 'Barangays';
    primaryKeyApiName: 'barangayId';
    primaryKeyType: 'string';
    properties: {
      /**
       *   property status: active
       *
       *   display name: 'Barangay id'
       */
      barangayId: $PropertyDef<'string', 'non-nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Canonical object'
       */
      canonicalId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'LGU'
       */
      lguId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Name'
       */
      name: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Passage'
       */
      passageId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Source record'
       */
      recordId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Investigation'
       */
      scenario: $PropertyDef<'string', 'nullable', 'single'>;
    };
    rid: 'ri.Barangay';
    status: 'ACTIVE';
    titleProperty: 'name';
    type: 'object';
    visibility: undefined;
  };
}

export const Barangay = {
  type: 'object',
  apiName: 'Barangay',
  osdkMetadata: $osdkMetadata,
  primaryKeyApiName: 'barangayId',
  primaryKeyType: 'string',
  internalDoNotUseMetadata: {
    rid: 'ri.Barangay',
  },
} satisfies Barangay & { internalDoNotUseMetadata: { rid: string } } as Barangay;
