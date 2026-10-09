import type { PropertyDef as $PropertyDef } from '@osdk/client';
import { $osdkMetadata } from '../../OntologyMetadata.js';
import type { $ExpectedClientVersion } from '../../OntologyMetadata.js';
import type { Document } from './Document.js';
import type { Person } from './Person.js';
import type { Organization } from './Organization.js';
import type { Location } from './Location.js';
import type { Event } from './Event.js';
import type { DigitalAccount } from './DigitalAccount.js';
import type { OnlineGroup } from './OnlineGroup.js';
import type { Incident } from './Incident.js';
import type { Firearm } from './Firearm.js';
import type { EvidenceItem } from './EvidenceItem.js';
import type { School } from './School.js';
import type { LGU } from './LGU.js';
import type { Barangay } from './Barangay.js';
import type { Hauler } from './Hauler.js';
import type { Contract } from './Contract.js';
import type { Facility } from './Facility.js';
import type { Vehicle } from './Vehicle.js';
import type { Inspection } from './Inspection.js';
import type { Complaint } from './Complaint.js';
import type { Thing } from './Thing.js';
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

export namespace Passage {
  export type PropertyKeys = 'charEnd' | 'charStart' | 'documentId' | 'index' | 'label' | 'passageId' | 'text';

  export interface Links {
    readonly document: $SingleLinkAccessor<Document>;
    readonly mentionedBarangays: Barangay.ObjectSet;
    readonly mentionedComplaints: Complaint.ObjectSet;
    readonly mentionedContracts: Contract.ObjectSet;
    readonly mentionedDigitalAccounts: DigitalAccount.ObjectSet;
    readonly mentionedEvents: Event.ObjectSet;
    readonly mentionedEvidenceItems: EvidenceItem.ObjectSet;
    readonly mentionedFacilities: Facility.ObjectSet;
    readonly mentionedFirearms: Firearm.ObjectSet;
    readonly mentionedHaulers: Hauler.ObjectSet;
    readonly mentionedIncidents: Incident.ObjectSet;
    readonly mentionedInspections: Inspection.ObjectSet;
    readonly mentionedLgus: LGU.ObjectSet;
    readonly mentionedLocations: Location.ObjectSet;
    readonly mentionedOnlineGroups: OnlineGroup.ObjectSet;
    readonly mentionedOrganizations: Organization.ObjectSet;
    readonly mentionedPeople: Person.ObjectSet;
    readonly mentionedSchools: School.ObjectSet;
    readonly mentionedThings: Thing.ObjectSet;
    readonly mentionedVehicles: Vehicle.ObjectSet;
  }

  export interface Props {
    /**
     *   property status: active
     *
     *   display name: 'End offset'
     */
    readonly charEnd: $PropType['integer'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Start offset'
     */
    readonly charStart: $PropType['integer'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Document'
     */
    readonly documentId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Index'
     */
    readonly index: $PropType['integer'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Label'
     */
    readonly label: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Passage id'
     */
    readonly passageId: $PropType['string'];
    /**
     *   property status: active
     *
     *   display name: 'Text'
     */
    readonly text: $PropType['string'] | undefined;
  }
  export type StrictProps = Props;

  export interface ObjectSet extends $ObjectSet<Passage, Passage.ObjectSet> {}

  export type OsdkInstance<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Passage.Props = keyof Passage.Props,
  > = $Osdk.Instance<Passage, OPTIONS, K>;

  /** @deprecated use OsdkInstance */
  export type OsdkObject<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Passage.Props = keyof Passage.Props,
  > = OsdkInstance<OPTIONS, K>;
}

export interface Passage extends $ObjectTypeDefinition {
  osdkMetadata: typeof $osdkMetadata;
  type: 'object';
  apiName: 'Passage';
  primaryKeyApiName: 'passageId';
  primaryKeyType: 'string';
  __DefinitionMetadata?: {
    objectSet: Passage.ObjectSet;
    props: Passage.Props;
    linksType: Passage.Links;
    strictProps: Passage.StrictProps;
    apiName: 'Passage';
    description: undefined;
    displayName: 'Passage';
    icon: {
      type: 'blueprint';
      color: '#2D72D2';
      name: 'cube';
    };
    implements: [];
    interfaceMap: {};
    inverseInterfaceMap: {};
    links: {
      document: $ObjectMetadata.Link<Document, false>;
      mentionedBarangays: $ObjectMetadata.Link<Barangay, true>;
      mentionedComplaints: $ObjectMetadata.Link<Complaint, true>;
      mentionedContracts: $ObjectMetadata.Link<Contract, true>;
      mentionedDigitalAccounts: $ObjectMetadata.Link<DigitalAccount, true>;
      mentionedEvents: $ObjectMetadata.Link<Event, true>;
      mentionedEvidenceItems: $ObjectMetadata.Link<EvidenceItem, true>;
      mentionedFacilities: $ObjectMetadata.Link<Facility, true>;
      mentionedFirearms: $ObjectMetadata.Link<Firearm, true>;
      mentionedHaulers: $ObjectMetadata.Link<Hauler, true>;
      mentionedIncidents: $ObjectMetadata.Link<Incident, true>;
      mentionedInspections: $ObjectMetadata.Link<Inspection, true>;
      mentionedLgus: $ObjectMetadata.Link<LGU, true>;
      mentionedLocations: $ObjectMetadata.Link<Location, true>;
      mentionedOnlineGroups: $ObjectMetadata.Link<OnlineGroup, true>;
      mentionedOrganizations: $ObjectMetadata.Link<Organization, true>;
      mentionedPeople: $ObjectMetadata.Link<Person, true>;
      mentionedSchools: $ObjectMetadata.Link<School, true>;
      mentionedThings: $ObjectMetadata.Link<Thing, true>;
      mentionedVehicles: $ObjectMetadata.Link<Vehicle, true>;
    };
    pluralDisplayName: 'Passages';
    primaryKeyApiName: 'passageId';
    primaryKeyType: 'string';
    properties: {
      /**
       *   property status: active
       *
       *   display name: 'End offset'
       */
      charEnd: $PropertyDef<'integer', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Start offset'
       */
      charStart: $PropertyDef<'integer', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Document'
       */
      documentId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Index'
       */
      index: $PropertyDef<'integer', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Label'
       */
      label: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Passage id'
       */
      passageId: $PropertyDef<'string', 'non-nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Text'
       */
      text: $PropertyDef<'string', 'nullable', 'single'>;
    };
    rid: 'ri.Passage';
    status: 'ACTIVE';
    titleProperty: 'label';
    type: 'object';
    visibility: undefined;
  };
}

export const Passage = {
  type: 'object',
  apiName: 'Passage',
  osdkMetadata: $osdkMetadata,
  primaryKeyApiName: 'passageId',
  primaryKeyType: 'string',
  internalDoNotUseMetadata: {
    rid: 'ri.Passage',
  },
} satisfies Passage & { internalDoNotUseMetadata: { rid: string } } as Passage;
