import type { PropertyDef as $PropertyDef } from '@osdk/client';
import { $osdkMetadata } from '../../OntologyMetadata.js';
import type { $ExpectedClientVersion } from '../../OntologyMetadata.js';
import type { Location } from './Location.js';
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

export namespace Event {
  export type PropertyKeys =
    | 'canonicalId'
    | 'endAt'
    | 'eventId'
    | 'kind'
    | 'locationId'
    | 'occurredAt'
    | 'passageId'
    | 'photoId'
    | 'recordId'
    | 'scenario'
    | 'startAt'
    | 'summary';

  export interface Links {
    readonly candidates: Event.ObjectSet;
    readonly canonical: $SingleLinkAccessor<Event>;
    readonly location: $SingleLinkAccessor<Location>;
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
     *   display name: 'End'
     */
    readonly endAt: $PropType['timestamp'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Event id'
     */
    readonly eventId: $PropType['string'];
    /**
     *   property status: active
     *
     *   display name: 'Kind'
     */
    readonly kind: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Location'
     */
    readonly locationId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Occurred at'
     */
    readonly occurredAt: $PropType['timestamp'] | undefined;
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
     *   display name: 'Investigation'
     */
    readonly scenario: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Start'
     */
    readonly startAt: $PropType['timestamp'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Summary'
     */
    readonly summary: $PropType['string'] | undefined;
  }
  export type StrictProps = Props;

  export interface ObjectSet extends $ObjectSet<Event, Event.ObjectSet> {}

  export type OsdkInstance<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Event.Props = keyof Event.Props,
  > = $Osdk.Instance<Event, OPTIONS, K>;

  /** @deprecated use OsdkInstance */
  export type OsdkObject<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Event.Props = keyof Event.Props,
  > = OsdkInstance<OPTIONS, K>;
}

export interface Event extends $ObjectTypeDefinition {
  osdkMetadata: typeof $osdkMetadata;
  type: 'object';
  apiName: 'Event';
  primaryKeyApiName: 'eventId';
  primaryKeyType: 'string';
  __DefinitionMetadata?: {
    objectSet: Event.ObjectSet;
    props: Event.Props;
    linksType: Event.Links;
    strictProps: Event.StrictProps;
    apiName: 'Event';
    description: undefined;
    displayName: 'Event';
    icon: {
      type: 'blueprint';
      color: '#2D72D2';
      name: 'cube';
    };
    implements: [];
    interfaceMap: {};
    inverseInterfaceMap: {};
    links: {
      candidates: $ObjectMetadata.Link<Event, true>;
      canonical: $ObjectMetadata.Link<Event, false>;
      location: $ObjectMetadata.Link<Location, false>;
      passage: $ObjectMetadata.Link<Passage, false>;
      relationshipsFrom: $ObjectMetadata.Link<Relationship, true>;
      relationshipsTo: $ObjectMetadata.Link<Relationship, true>;
      sourceRecord: $ObjectMetadata.Link<SourceRecord, false>;
    };
    pluralDisplayName: 'Events';
    primaryKeyApiName: 'eventId';
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
       *   display name: 'End'
       */
      endAt: $PropertyDef<'timestamp', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Event id'
       */
      eventId: $PropertyDef<'string', 'non-nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Kind'
       */
      kind: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Location'
       */
      locationId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Occurred at'
       */
      occurredAt: $PropertyDef<'timestamp', 'nullable', 'single'>;
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
       *   display name: 'Investigation'
       */
      scenario: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Start'
       */
      startAt: $PropertyDef<'timestamp', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Summary'
       */
      summary: $PropertyDef<'string', 'nullable', 'single'>;
    };
    rid: 'ri.Event';
    status: 'ACTIVE';
    titleProperty: 'summary';
    type: 'object';
    visibility: undefined;
  };
}

export const Event = {
  type: 'object',
  apiName: 'Event',
  osdkMetadata: $osdkMetadata,
  primaryKeyApiName: 'eventId',
  primaryKeyType: 'string',
  internalDoNotUseMetadata: {
    rid: 'ri.Event',
  },
} satisfies Event & { internalDoNotUseMetadata: { rid: string } } as Event;
