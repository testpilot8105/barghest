import type { PropertyDef as $PropertyDef } from '@osdk/client';
import { $osdkMetadata } from '../../OntologyMetadata.js';
import type { $ExpectedClientVersion } from '../../OntologyMetadata.js';
import type { Barangay } from './Barangay.js';
import type { Facility } from './Facility.js';
import type { Contract } from './Contract.js';
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

export namespace LGU {
  export type PropertyKeys =
    | 'canonicalId'
    | 'kind'
    | 'lguId'
    | 'name'
    | 'passageId'
    | 'province'
    | 'recordId'
    | 'scenario';

  export interface Links {
    readonly barangays: Barangay.ObjectSet;
    readonly candidates: LGU.ObjectSet;
    readonly canonical: $SingleLinkAccessor<LGU>;
    readonly contracts: Contract.ObjectSet;
    readonly facilities: Facility.ObjectSet;
    readonly passage: $SingleLinkAccessor<Passage>;
    readonly relationshipsFrom: Relationship.ObjectSet;
    readonly relationshipsTo: Relationship.ObjectSet;
    readonly sourceRecord: $SingleLinkAccessor<SourceRecord>;
  }

  export interface Props {
    /**
     *   property status: active
     *
     *   display name: 'Canonical object'
     */
    readonly canonicalId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Kind'
     */
    readonly kind: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'LGU id'
     */
    readonly lguId: $PropType['string'];
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
     *   display name: 'Province'
     */
    readonly province: $PropType['string'] | undefined;
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

  export interface ObjectSet extends $ObjectSet<LGU, LGU.ObjectSet> {}

  export type OsdkInstance<
    OPTIONS extends never | '$rid' = never,
    K extends keyof LGU.Props = keyof LGU.Props,
  > = $Osdk.Instance<LGU, OPTIONS, K>;

  /** @deprecated use OsdkInstance */
  export type OsdkObject<
    OPTIONS extends never | '$rid' = never,
    K extends keyof LGU.Props = keyof LGU.Props,
  > = OsdkInstance<OPTIONS, K>;
}

export interface LGU extends $ObjectTypeDefinition {
  osdkMetadata: typeof $osdkMetadata;
  type: 'object';
  apiName: 'LGU';
  primaryKeyApiName: 'lguId';
  primaryKeyType: 'string';
  __DefinitionMetadata?: {
    objectSet: LGU.ObjectSet;
    props: LGU.Props;
    linksType: LGU.Links;
    strictProps: LGU.StrictProps;
    apiName: 'LGU';
    description: undefined;
    displayName: 'LGU';
    icon: {
      type: 'blueprint';
      color: '#2D72D2';
      name: 'cube';
    };
    implements: [];
    interfaceMap: {};
    inverseInterfaceMap: {};
    links: {
      barangays: $ObjectMetadata.Link<Barangay, true>;
      candidates: $ObjectMetadata.Link<LGU, true>;
      canonical: $ObjectMetadata.Link<LGU, false>;
      contracts: $ObjectMetadata.Link<Contract, true>;
      facilities: $ObjectMetadata.Link<Facility, true>;
      passage: $ObjectMetadata.Link<Passage, false>;
      relationshipsFrom: $ObjectMetadata.Link<Relationship, true>;
      relationshipsTo: $ObjectMetadata.Link<Relationship, true>;
      sourceRecord: $ObjectMetadata.Link<SourceRecord, false>;
    };
    pluralDisplayName: 'LGUs';
    primaryKeyApiName: 'lguId';
    primaryKeyType: 'string';
    properties: {
      /**
       *   property status: active
       *
       *   display name: 'Canonical object'
       */
      canonicalId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Kind'
       */
      kind: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'LGU id'
       */
      lguId: $PropertyDef<'string', 'non-nullable', 'single'>;
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
       *   display name: 'Province'
       */
      province: $PropertyDef<'string', 'nullable', 'single'>;
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
    rid: 'ri.LGU';
    status: 'ACTIVE';
    titleProperty: 'name';
    type: 'object';
    visibility: undefined;
  };
}

export const LGU = {
  type: 'object',
  apiName: 'LGU',
  osdkMetadata: $osdkMetadata,
  primaryKeyApiName: 'lguId',
  primaryKeyType: 'string',
  internalDoNotUseMetadata: {
    rid: 'ri.LGU',
  },
} satisfies LGU & { internalDoNotUseMetadata: { rid: string } } as LGU;
