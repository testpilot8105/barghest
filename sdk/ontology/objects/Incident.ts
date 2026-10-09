import type { PropertyDef as $PropertyDef } from '@osdk/client';
import { $osdkMetadata } from '../../OntologyMetadata.js';
import type { $ExpectedClientVersion } from '../../OntologyMetadata.js';
import type { EvidenceItem } from './EvidenceItem.js';
import type { Location } from './Location.js';
import type { School } from './School.js';
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

export namespace Incident {
  export type PropertyKeys =
    | 'canonicalId'
    | 'incidentId'
    | 'label'
    | 'locationId'
    | 'occurredAt'
    | 'passageId'
    | 'recordId'
    | 'scenario'
    | 'schoolId'
    | 'summary';

  export interface Links {
    readonly candidates: Incident.ObjectSet;
    readonly canonical: $SingleLinkAccessor<Incident>;
    readonly evidenceItems: EvidenceItem.ObjectSet;
    readonly location: $SingleLinkAccessor<Location>;
    readonly passage: $SingleLinkAccessor<Passage>;
    readonly relationshipsFrom: Relationship.ObjectSet;
    readonly relationshipsTo: Relationship.ObjectSet;
    readonly school: $SingleLinkAccessor<School>;
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
     *   display name: 'Incident id'
     */
    readonly incidentId: $PropType['string'];
    /**
     *   property status: active
     *
     *   display name: 'Label'
     */
    readonly label: $PropType['string'] | undefined;
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
     *   display name: 'School'
     */
    readonly schoolId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Summary'
     */
    readonly summary: $PropType['string'] | undefined;
  }
  export type StrictProps = Props;

  export interface ObjectSet extends $ObjectSet<Incident, Incident.ObjectSet> {}

  export type OsdkInstance<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Incident.Props = keyof Incident.Props,
  > = $Osdk.Instance<Incident, OPTIONS, K>;

  /** @deprecated use OsdkInstance */
  export type OsdkObject<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Incident.Props = keyof Incident.Props,
  > = OsdkInstance<OPTIONS, K>;
}

export interface Incident extends $ObjectTypeDefinition {
  osdkMetadata: typeof $osdkMetadata;
  type: 'object';
  apiName: 'Incident';
  primaryKeyApiName: 'incidentId';
  primaryKeyType: 'string';
  __DefinitionMetadata?: {
    objectSet: Incident.ObjectSet;
    props: Incident.Props;
    linksType: Incident.Links;
    strictProps: Incident.StrictProps;
    apiName: 'Incident';
    description: undefined;
    displayName: 'Incident';
    icon: {
      type: 'blueprint';
      color: '#2D72D2';
      name: 'cube';
    };
    implements: [];
    interfaceMap: {};
    inverseInterfaceMap: {};
    links: {
      candidates: $ObjectMetadata.Link<Incident, true>;
      canonical: $ObjectMetadata.Link<Incident, false>;
      evidenceItems: $ObjectMetadata.Link<EvidenceItem, true>;
      location: $ObjectMetadata.Link<Location, false>;
      passage: $ObjectMetadata.Link<Passage, false>;
      relationshipsFrom: $ObjectMetadata.Link<Relationship, true>;
      relationshipsTo: $ObjectMetadata.Link<Relationship, true>;
      school: $ObjectMetadata.Link<School, false>;
      sourceRecord: $ObjectMetadata.Link<SourceRecord, false>;
    };
    pluralDisplayName: 'Incidents';
    primaryKeyApiName: 'incidentId';
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
       *   display name: 'Incident id'
       */
      incidentId: $PropertyDef<'string', 'non-nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Label'
       */
      label: $PropertyDef<'string', 'nullable', 'single'>;
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
       *   display name: 'School'
       */
      schoolId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Summary'
       */
      summary: $PropertyDef<'string', 'nullable', 'single'>;
    };
    rid: 'ri.Incident';
    status: 'ACTIVE';
    titleProperty: 'label';
    type: 'object';
    visibility: undefined;
  };
}

export const Incident = {
  type: 'object',
  apiName: 'Incident',
  osdkMetadata: $osdkMetadata,
  primaryKeyApiName: 'incidentId',
  primaryKeyType: 'string',
  internalDoNotUseMetadata: {
    rid: 'ri.Incident',
  },
} satisfies Incident & { internalDoNotUseMetadata: { rid: string } } as Incident;
