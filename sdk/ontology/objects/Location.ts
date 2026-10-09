import type { PropertyDef as $PropertyDef } from '@osdk/client';
import { $osdkMetadata } from '../../OntologyMetadata.js';
import type { $ExpectedClientVersion } from '../../OntologyMetadata.js';
import type { Event } from './Event.js';
import type { Incident } from './Incident.js';
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

export namespace Location {
  export type PropertyKeys =
    | 'canonicalId'
    | 'kind'
    | 'lat'
    | 'locationId'
    | 'lon'
    | 'name'
    | 'passageId'
    | 'recordId'
    | 'scenario';

  export interface Links {
    readonly candidates: Location.ObjectSet;
    readonly canonical: $SingleLinkAccessor<Location>;
    readonly events: Event.ObjectSet;
    readonly incidents: Incident.ObjectSet;
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
     *   display name: 'Latitude'
     */
    readonly lat: $PropType['double'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Location id'
     */
    readonly locationId: $PropType['string'];
    /**
     *   property status: active
     *
     *   display name: 'Longitude'
     */
    readonly lon: $PropType['double'] | undefined;
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

  export interface ObjectSet extends $ObjectSet<Location, Location.ObjectSet> {}

  export type OsdkInstance<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Location.Props = keyof Location.Props,
  > = $Osdk.Instance<Location, OPTIONS, K>;

  /** @deprecated use OsdkInstance */
  export type OsdkObject<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Location.Props = keyof Location.Props,
  > = OsdkInstance<OPTIONS, K>;
}

export interface Location extends $ObjectTypeDefinition {
  osdkMetadata: typeof $osdkMetadata;
  type: 'object';
  apiName: 'Location';
  primaryKeyApiName: 'locationId';
  primaryKeyType: 'string';
  __DefinitionMetadata?: {
    objectSet: Location.ObjectSet;
    props: Location.Props;
    linksType: Location.Links;
    strictProps: Location.StrictProps;
    apiName: 'Location';
    description: undefined;
    displayName: 'Location';
    icon: {
      type: 'blueprint';
      color: '#2D72D2';
      name: 'cube';
    };
    implements: [];
    interfaceMap: {};
    inverseInterfaceMap: {};
    links: {
      candidates: $ObjectMetadata.Link<Location, true>;
      canonical: $ObjectMetadata.Link<Location, false>;
      events: $ObjectMetadata.Link<Event, true>;
      incidents: $ObjectMetadata.Link<Incident, true>;
      passage: $ObjectMetadata.Link<Passage, false>;
      relationshipsFrom: $ObjectMetadata.Link<Relationship, true>;
      relationshipsTo: $ObjectMetadata.Link<Relationship, true>;
      sourceRecord: $ObjectMetadata.Link<SourceRecord, false>;
    };
    pluralDisplayName: 'Locations';
    primaryKeyApiName: 'locationId';
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
       *   display name: 'Latitude'
       */
      lat: $PropertyDef<'double', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Location id'
       */
      locationId: $PropertyDef<'string', 'non-nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Longitude'
       */
      lon: $PropertyDef<'double', 'nullable', 'single'>;
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
    rid: 'ri.Location';
    status: 'ACTIVE';
    titleProperty: 'name';
    type: 'object';
    visibility: undefined;
  };
}

export const Location = {
  type: 'object',
  apiName: 'Location',
  osdkMetadata: $osdkMetadata,
  primaryKeyApiName: 'locationId',
  primaryKeyType: 'string',
  internalDoNotUseMetadata: {
    rid: 'ri.Location',
  },
} satisfies Location & { internalDoNotUseMetadata: { rid: string } } as Location;
