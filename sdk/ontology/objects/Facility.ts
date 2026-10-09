import type { PropertyDef as $PropertyDef } from '@osdk/client';
import { $osdkMetadata } from '../../OntologyMetadata.js';
import type { $ExpectedClientVersion } from '../../OntologyMetadata.js';
import type { LGU } from './LGU.js';
import type { Inspection } from './Inspection.js';
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

export namespace Facility {
  export type PropertyKeys =
    | 'canonicalId'
    | 'facilityId'
    | 'kind'
    | 'lguId'
    | 'name'
    | 'passageId'
    | 'permitNo'
    | 'photoId'
    | 'recordId'
    | 'scenario'
    | 'status';

  export interface Links {
    readonly candidates: Facility.ObjectSet;
    readonly canonical: $SingleLinkAccessor<Facility>;
    readonly inspections: Inspection.ObjectSet;
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
     *   display name: 'Canonical object'
     */
    readonly canonicalId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Facility id'
     */
    readonly facilityId: $PropType['string'];
    /**
     *   property status: active
     *
     *   display name: 'Kind'
     */
    readonly kind: $PropType['string'] | undefined;
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
     *   display name: 'Permit no.'
     */
    readonly permitNo: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Photo'
     */
    readonly photoId: $PropType['string'] | undefined;
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
    /**
     *   property status: active
     *
     *   display name: 'Status'
     */
    readonly status: $PropType['string'] | undefined;
  }
  export type StrictProps = Props;

  export interface ObjectSet extends $ObjectSet<Facility, Facility.ObjectSet> {}

  export type OsdkInstance<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Facility.Props = keyof Facility.Props,
  > = $Osdk.Instance<Facility, OPTIONS, K>;

  /** @deprecated use OsdkInstance */
  export type OsdkObject<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Facility.Props = keyof Facility.Props,
  > = OsdkInstance<OPTIONS, K>;
}

export interface Facility extends $ObjectTypeDefinition {
  osdkMetadata: typeof $osdkMetadata;
  type: 'object';
  apiName: 'Facility';
  primaryKeyApiName: 'facilityId';
  primaryKeyType: 'string';
  __DefinitionMetadata?: {
    objectSet: Facility.ObjectSet;
    props: Facility.Props;
    linksType: Facility.Links;
    strictProps: Facility.StrictProps;
    apiName: 'Facility';
    description: undefined;
    displayName: 'Facility';
    icon: {
      type: 'blueprint';
      color: '#2D72D2';
      name: 'cube';
    };
    implements: [];
    interfaceMap: {};
    inverseInterfaceMap: {};
    links: {
      candidates: $ObjectMetadata.Link<Facility, true>;
      canonical: $ObjectMetadata.Link<Facility, false>;
      inspections: $ObjectMetadata.Link<Inspection, true>;
      lgu: $ObjectMetadata.Link<LGU, false>;
      passage: $ObjectMetadata.Link<Passage, false>;
      relationshipsFrom: $ObjectMetadata.Link<Relationship, true>;
      relationshipsTo: $ObjectMetadata.Link<Relationship, true>;
      sourceRecord: $ObjectMetadata.Link<SourceRecord, false>;
    };
    pluralDisplayName: 'Facilities';
    primaryKeyApiName: 'facilityId';
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
       *   display name: 'Facility id'
       */
      facilityId: $PropertyDef<'string', 'non-nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Kind'
       */
      kind: $PropertyDef<'string', 'nullable', 'single'>;
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
       *   display name: 'Permit no.'
       */
      permitNo: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Photo'
       */
      photoId: $PropertyDef<'string', 'nullable', 'single'>;
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
      /**
       *   property status: active
       *
       *   display name: 'Status'
       */
      status: $PropertyDef<'string', 'nullable', 'single'>;
    };
    rid: 'ri.Facility';
    status: 'ACTIVE';
    titleProperty: 'name';
    type: 'object';
    visibility: undefined;
  };
}

export const Facility = {
  type: 'object',
  apiName: 'Facility',
  osdkMetadata: $osdkMetadata,
  primaryKeyApiName: 'facilityId',
  primaryKeyType: 'string',
  internalDoNotUseMetadata: {
    rid: 'ri.Facility',
  },
} satisfies Facility & { internalDoNotUseMetadata: { rid: string } } as Facility;
