import type { PropertyDef as $PropertyDef } from '@osdk/client';
import { $osdkMetadata } from '../../OntologyMetadata.js';
import type { $ExpectedClientVersion } from '../../OntologyMetadata.js';
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

export namespace Vehicle {
  export type PropertyKeys =
    | 'bodyNo'
    | 'canonicalId'
    | 'haulerId'
    | 'passageId'
    | 'plateNo'
    | 'recordId'
    | 'scenario'
    | 'vehicleId';

  export interface Links {
    readonly candidates: Vehicle.ObjectSet;
    readonly canonical: $SingleLinkAccessor<Vehicle>;
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
     *   display name: 'Body no.'
     */
    readonly bodyNo: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Canonical object'
     */
    readonly canonicalId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Hauler'
     */
    readonly haulerId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Passage'
     */
    readonly passageId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Plate no.'
     */
    readonly plateNo: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Source record'
     */
    readonly recordId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Scenario'
     */
    readonly scenario: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Vehicle id'
     */
    readonly vehicleId: $PropType['string'];
  }
  export type StrictProps = Props;

  export interface ObjectSet extends $ObjectSet<Vehicle, Vehicle.ObjectSet> {}

  export type OsdkInstance<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Vehicle.Props = keyof Vehicle.Props,
  > = $Osdk.Instance<Vehicle, OPTIONS, K>;

  /** @deprecated use OsdkInstance */
  export type OsdkObject<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Vehicle.Props = keyof Vehicle.Props,
  > = OsdkInstance<OPTIONS, K>;
}

export interface Vehicle extends $ObjectTypeDefinition {
  osdkMetadata: typeof $osdkMetadata;
  type: 'object';
  apiName: 'Vehicle';
  primaryKeyApiName: 'vehicleId';
  primaryKeyType: 'string';
  __DefinitionMetadata?: {
    objectSet: Vehicle.ObjectSet;
    props: Vehicle.Props;
    linksType: Vehicle.Links;
    strictProps: Vehicle.StrictProps;
    apiName: 'Vehicle';
    description: undefined;
    displayName: 'Vehicle';
    icon: {
      type: 'blueprint';
      color: '#2D72D2';
      name: 'cube';
    };
    implements: [];
    interfaceMap: {};
    inverseInterfaceMap: {};
    links: {
      candidates: $ObjectMetadata.Link<Vehicle, true>;
      canonical: $ObjectMetadata.Link<Vehicle, false>;
      hauler: $ObjectMetadata.Link<Hauler, false>;
      passage: $ObjectMetadata.Link<Passage, false>;
      relationshipsFrom: $ObjectMetadata.Link<Relationship, true>;
      relationshipsTo: $ObjectMetadata.Link<Relationship, true>;
      sourceRecord: $ObjectMetadata.Link<SourceRecord, false>;
    };
    pluralDisplayName: 'Vehicles';
    primaryKeyApiName: 'vehicleId';
    primaryKeyType: 'string';
    properties: {
      /**
       *   property status: active
       *
       *   display name: 'Body no.'
       */
      bodyNo: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Canonical object'
       */
      canonicalId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Hauler'
       */
      haulerId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Passage'
       */
      passageId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Plate no.'
       */
      plateNo: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Source record'
       */
      recordId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Scenario'
       */
      scenario: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Vehicle id'
       */
      vehicleId: $PropertyDef<'string', 'non-nullable', 'single'>;
    };
    rid: 'ri.Vehicle';
    status: 'ACTIVE';
    titleProperty: 'plateNo';
    type: 'object';
    visibility: undefined;
  };
}

export const Vehicle = {
  type: 'object',
  apiName: 'Vehicle',
  osdkMetadata: $osdkMetadata,
  primaryKeyApiName: 'vehicleId',
  primaryKeyType: 'string',
  internalDoNotUseMetadata: {
    rid: 'ri.Vehicle',
  },
} satisfies Vehicle & { internalDoNotUseMetadata: { rid: string } } as Vehicle;
