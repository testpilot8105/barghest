import type { PropertyDef as $PropertyDef } from '@osdk/client';
import { $osdkMetadata } from '../../OntologyMetadata.js';
import type { $ExpectedClientVersion } from '../../OntologyMetadata.js';
import type { Facility } from './Facility.js';
import type { Hauler } from './Hauler.js';
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

export namespace Inspection {
  export type PropertyKeys =
    | 'agency'
    | 'canonicalId'
    | 'facilityId'
    | 'haulerId'
    | 'inspectedAt'
    | 'inspectionId'
    | 'label'
    | 'passageId'
    | 'photoId'
    | 'recordId'
    | 'result'
    | 'scenario';

  export interface Links {
    readonly candidates: Inspection.ObjectSet;
    readonly canonical: $SingleLinkAccessor<Inspection>;
    readonly facility: $SingleLinkAccessor<Facility>;
    readonly hauler: $SingleLinkAccessor<Hauler>;
    readonly passage: $SingleLinkAccessor<Passage>;
    readonly relationshipsFrom: Relationship.ObjectSet;
    readonly relationshipsTo: Relationship.ObjectSet;
    readonly sourceRecord: $SingleLinkAccessor<SourceRecord>;
  }

  export interface Props {
    /**
     *   property status: active
     *
     *   display name: 'Agency'
     */
    readonly agency: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Canonical object'
     */
    readonly canonicalId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Facility'
     */
    readonly facilityId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Hauler'
     */
    readonly haulerId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Inspected at'
     */
    readonly inspectedAt: $PropType['timestamp'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Inspection id'
     */
    readonly inspectionId: $PropType['string'];
    /**
     *   property status: active
     *
     *   display name: 'Label'
     */
    readonly label: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Passage'
     */
    readonly passageId: $PropType['string'] | undefined;
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
     *   display name: 'Result'
     */
    readonly result: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Investigation'
     */
    readonly scenario: $PropType['string'] | undefined;
  }
  export type StrictProps = Props;

  export interface ObjectSet extends $ObjectSet<Inspection, Inspection.ObjectSet> {}

  export type OsdkInstance<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Inspection.Props = keyof Inspection.Props,
  > = $Osdk.Instance<Inspection, OPTIONS, K>;

  /** @deprecated use OsdkInstance */
  export type OsdkObject<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Inspection.Props = keyof Inspection.Props,
  > = OsdkInstance<OPTIONS, K>;
}

export interface Inspection extends $ObjectTypeDefinition {
  osdkMetadata: typeof $osdkMetadata;
  type: 'object';
  apiName: 'Inspection';
  primaryKeyApiName: 'inspectionId';
  primaryKeyType: 'string';
  __DefinitionMetadata?: {
    objectSet: Inspection.ObjectSet;
    props: Inspection.Props;
    linksType: Inspection.Links;
    strictProps: Inspection.StrictProps;
    apiName: 'Inspection';
    description: undefined;
    displayName: 'Inspection';
    icon: {
      type: 'blueprint';
      color: '#2D72D2';
      name: 'cube';
    };
    implements: [];
    interfaceMap: {};
    inverseInterfaceMap: {};
    links: {
      candidates: $ObjectMetadata.Link<Inspection, true>;
      canonical: $ObjectMetadata.Link<Inspection, false>;
      facility: $ObjectMetadata.Link<Facility, false>;
      hauler: $ObjectMetadata.Link<Hauler, false>;
      passage: $ObjectMetadata.Link<Passage, false>;
      relationshipsFrom: $ObjectMetadata.Link<Relationship, true>;
      relationshipsTo: $ObjectMetadata.Link<Relationship, true>;
      sourceRecord: $ObjectMetadata.Link<SourceRecord, false>;
    };
    pluralDisplayName: 'Inspections';
    primaryKeyApiName: 'inspectionId';
    primaryKeyType: 'string';
    properties: {
      /**
       *   property status: active
       *
       *   display name: 'Agency'
       */
      agency: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Canonical object'
       */
      canonicalId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Facility'
       */
      facilityId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Hauler'
       */
      haulerId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Inspected at'
       */
      inspectedAt: $PropertyDef<'timestamp', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Inspection id'
       */
      inspectionId: $PropertyDef<'string', 'non-nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Label'
       */
      label: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Passage'
       */
      passageId: $PropertyDef<'string', 'nullable', 'single'>;
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
       *   display name: 'Result'
       */
      result: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Investigation'
       */
      scenario: $PropertyDef<'string', 'nullable', 'single'>;
    };
    rid: 'ri.Inspection';
    status: 'ACTIVE';
    titleProperty: 'label';
    type: 'object';
    visibility: undefined;
  };
}

export const Inspection = {
  type: 'object',
  apiName: 'Inspection',
  osdkMetadata: $osdkMetadata,
  primaryKeyApiName: 'inspectionId',
  primaryKeyType: 'string',
  internalDoNotUseMetadata: {
    rid: 'ri.Inspection',
  },
} satisfies Inspection & { internalDoNotUseMetadata: { rid: string } } as Inspection;
