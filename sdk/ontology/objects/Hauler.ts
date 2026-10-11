import type { PropertyDef as $PropertyDef } from '@osdk/client';
import { $osdkMetadata } from '../../OntologyMetadata.js';
import type { $ExpectedClientVersion } from '../../OntologyMetadata.js';
import type { Contract } from './Contract.js';
import type { Vehicle } from './Vehicle.js';
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

export namespace Hauler {
  export type PropertyKeys =
    | 'canonicalId'
    | 'haulerId'
    | 'name'
    | 'passageId'
    | 'photoId'
    | 'recordId'
    | 'registrationNo'
    | 'scenario'
    | 'tin';

  export interface Links {
    readonly candidates: Hauler.ObjectSet;
    readonly canonical: $SingleLinkAccessor<Hauler>;
    readonly contracts: Contract.ObjectSet;
    readonly inspections: Inspection.ObjectSet;
    readonly passage: $SingleLinkAccessor<Passage>;
    readonly relationshipsFrom: Relationship.ObjectSet;
    readonly relationshipsTo: Relationship.ObjectSet;
    readonly sourceRecord: $SingleLinkAccessor<SourceRecord>;
    readonly vehicles: Vehicle.ObjectSet;
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
     *   display name: 'Hauler id'
     */
    readonly haulerId: $PropType['string'];
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
     *   display name: 'Registration no.'
     */
    readonly registrationNo: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Investigation'
     */
    readonly scenario: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Tax ID'
     */
    readonly tin: $PropType['string'] | undefined;
  }
  export type StrictProps = Props;

  export interface ObjectSet extends $ObjectSet<Hauler, Hauler.ObjectSet> {}

  export type OsdkInstance<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Hauler.Props = keyof Hauler.Props,
  > = $Osdk.Instance<Hauler, OPTIONS, K>;

  /** @deprecated use OsdkInstance */
  export type OsdkObject<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Hauler.Props = keyof Hauler.Props,
  > = OsdkInstance<OPTIONS, K>;
}

export interface Hauler extends $ObjectTypeDefinition {
  osdkMetadata: typeof $osdkMetadata;
  type: 'object';
  apiName: 'Hauler';
  primaryKeyApiName: 'haulerId';
  primaryKeyType: 'string';
  __DefinitionMetadata?: {
    objectSet: Hauler.ObjectSet;
    props: Hauler.Props;
    linksType: Hauler.Links;
    strictProps: Hauler.StrictProps;
    apiName: 'Hauler';
    description: undefined;
    displayName: 'Hauler';
    icon: {
      type: 'blueprint';
      color: '#2D72D2';
      name: 'cube';
    };
    implements: [];
    interfaceMap: {};
    inverseInterfaceMap: {};
    links: {
      candidates: $ObjectMetadata.Link<Hauler, true>;
      canonical: $ObjectMetadata.Link<Hauler, false>;
      contracts: $ObjectMetadata.Link<Contract, true>;
      inspections: $ObjectMetadata.Link<Inspection, true>;
      passage: $ObjectMetadata.Link<Passage, false>;
      relationshipsFrom: $ObjectMetadata.Link<Relationship, true>;
      relationshipsTo: $ObjectMetadata.Link<Relationship, true>;
      sourceRecord: $ObjectMetadata.Link<SourceRecord, false>;
      vehicles: $ObjectMetadata.Link<Vehicle, true>;
    };
    pluralDisplayName: 'Haulers';
    primaryKeyApiName: 'haulerId';
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
       *   display name: 'Hauler id'
       */
      haulerId: $PropertyDef<'string', 'non-nullable', 'single'>;
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
       *   display name: 'Registration no.'
       */
      registrationNo: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Investigation'
       */
      scenario: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Tax ID'
       */
      tin: $PropertyDef<'string', 'nullable', 'single'>;
    };
    rid: 'ri.Hauler';
    status: 'ACTIVE';
    titleProperty: 'name';
    type: 'object';
    visibility: undefined;
  };
}

export const Hauler = {
  type: 'object',
  apiName: 'Hauler',
  osdkMetadata: $osdkMetadata,
  primaryKeyApiName: 'haulerId',
  primaryKeyType: 'string',
  internalDoNotUseMetadata: {
    rid: 'ri.Hauler',
  },
} satisfies Hauler & { internalDoNotUseMetadata: { rid: string } } as Hauler;
