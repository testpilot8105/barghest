import type { PropertyDef as $PropertyDef } from '@osdk/client';
import { $osdkMetadata } from '../../OntologyMetadata.js';
import type { $ExpectedClientVersion } from '../../OntologyMetadata.js';
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
import type { Document } from './Document.js';
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

export namespace Relationship {
  export type PropertyKeys =
    | 'confidence'
    | 'fromBarangayId'
    | 'fromComplaintId'
    | 'fromContractId'
    | 'fromDigitalAccountId'
    | 'fromDocumentId'
    | 'fromEventId'
    | 'fromEvidenceItemId'
    | 'fromFacilityId'
    | 'fromFirearmId'
    | 'fromHaulerId'
    | 'fromId'
    | 'fromIncidentId'
    | 'fromInspectionId'
    | 'fromLGUId'
    | 'fromLocationId'
    | 'fromOnlineGroupId'
    | 'fromOrganizationId'
    | 'fromPersonId'
    | 'fromSchoolId'
    | 'fromThingId'
    | 'fromType'
    | 'fromVehicleId'
    | 'kind'
    | 'kindLabel'
    | 'label'
    | 'method'
    | 'observedAt'
    | 'passageIds'
    | 'recordIds'
    | 'relationshipId'
    | 'reviewNote'
    | 'scenario'
    | 'status'
    | 'toBarangayId'
    | 'toComplaintId'
    | 'toContractId'
    | 'toDigitalAccountId'
    | 'toDocumentId'
    | 'toEventId'
    | 'toEvidenceItemId'
    | 'toFacilityId'
    | 'toFirearmId'
    | 'toHaulerId'
    | 'toId'
    | 'toIncidentId'
    | 'toInspectionId'
    | 'toLGUId'
    | 'toLocationId'
    | 'toOnlineGroupId'
    | 'toOrganizationId'
    | 'toPersonId'
    | 'toSchoolId'
    | 'toThingId'
    | 'toType'
    | 'toVehicleId';

  export interface Links {
    readonly fromBarangay: $SingleLinkAccessor<Barangay>;
    readonly fromComplaint: $SingleLinkAccessor<Complaint>;
    readonly fromContract: $SingleLinkAccessor<Contract>;
    readonly fromDigitalAccount: $SingleLinkAccessor<DigitalAccount>;
    readonly fromDocument: $SingleLinkAccessor<Document>;
    readonly fromEvent: $SingleLinkAccessor<Event>;
    readonly fromEvidenceItem: $SingleLinkAccessor<EvidenceItem>;
    readonly fromFacility: $SingleLinkAccessor<Facility>;
    readonly fromFirearm: $SingleLinkAccessor<Firearm>;
    readonly fromHauler: $SingleLinkAccessor<Hauler>;
    readonly fromIncident: $SingleLinkAccessor<Incident>;
    readonly fromInspection: $SingleLinkAccessor<Inspection>;
    readonly fromLGU: $SingleLinkAccessor<LGU>;
    readonly fromLocation: $SingleLinkAccessor<Location>;
    readonly fromOnlineGroup: $SingleLinkAccessor<OnlineGroup>;
    readonly fromOrganization: $SingleLinkAccessor<Organization>;
    readonly fromPerson: $SingleLinkAccessor<Person>;
    readonly fromSchool: $SingleLinkAccessor<School>;
    readonly fromThing: $SingleLinkAccessor<Thing>;
    readonly fromVehicle: $SingleLinkAccessor<Vehicle>;
    readonly toBarangay: $SingleLinkAccessor<Barangay>;
    readonly toComplaint: $SingleLinkAccessor<Complaint>;
    readonly toContract: $SingleLinkAccessor<Contract>;
    readonly toDigitalAccount: $SingleLinkAccessor<DigitalAccount>;
    readonly toDocument: $SingleLinkAccessor<Document>;
    readonly toEvent: $SingleLinkAccessor<Event>;
    readonly toEvidenceItem: $SingleLinkAccessor<EvidenceItem>;
    readonly toFacility: $SingleLinkAccessor<Facility>;
    readonly toFirearm: $SingleLinkAccessor<Firearm>;
    readonly toHauler: $SingleLinkAccessor<Hauler>;
    readonly toIncident: $SingleLinkAccessor<Incident>;
    readonly toInspection: $SingleLinkAccessor<Inspection>;
    readonly toLGU: $SingleLinkAccessor<LGU>;
    readonly toLocation: $SingleLinkAccessor<Location>;
    readonly toOnlineGroup: $SingleLinkAccessor<OnlineGroup>;
    readonly toOrganization: $SingleLinkAccessor<Organization>;
    readonly toPerson: $SingleLinkAccessor<Person>;
    readonly toSchool: $SingleLinkAccessor<School>;
    readonly toThing: $SingleLinkAccessor<Thing>;
    readonly toVehicle: $SingleLinkAccessor<Vehicle>;
  }

  export interface Props {
    /**
     *   property status: active
     *
     *   display name: 'Confidence'
     */
    readonly confidence: $PropType['double'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'From barangay'
     */
    readonly fromBarangayId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'From complaint'
     */
    readonly fromComplaintId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'From contract'
     */
    readonly fromContractId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'From digital account'
     */
    readonly fromDigitalAccountId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'From document'
     */
    readonly fromDocumentId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'From event'
     */
    readonly fromEventId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'From evidence item'
     */
    readonly fromEvidenceItemId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'From facility'
     */
    readonly fromFacilityId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'From firearm'
     */
    readonly fromFirearmId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'From hauler'
     */
    readonly fromHaulerId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'From id'
     */
    readonly fromId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'From incident'
     */
    readonly fromIncidentId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'From inspection'
     */
    readonly fromInspectionId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'From lgu'
     */
    readonly fromLGUId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'From location'
     */
    readonly fromLocationId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'From online group'
     */
    readonly fromOnlineGroupId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'From organization'
     */
    readonly fromOrganizationId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'From person'
     */
    readonly fromPersonId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'From school'
     */
    readonly fromSchoolId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'From other thing'
     */
    readonly fromThingId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'From type'
     */
    readonly fromType: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'From vehicle'
     */
    readonly fromVehicleId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Kind'
     */
    readonly kind: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Kind, as written'
     */
    readonly kindLabel: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Label'
     */
    readonly label: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Method'
     */
    readonly method: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Observed at'
     */
    readonly observedAt: $PropType['timestamp'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Passages'
     */
    readonly passageIds: $PropType['string'][] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Source records'
     */
    readonly recordIds: $PropType['string'][] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Relationship id'
     */
    readonly relationshipId: $PropType['string'];
    /**
     *   property status: active
     *
     *   display name: 'Review note'
     */
    readonly reviewNote: $PropType['string'] | undefined;
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
    /**
     *   property status: active
     *
     *   display name: 'To barangay'
     */
    readonly toBarangayId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'To complaint'
     */
    readonly toComplaintId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'To contract'
     */
    readonly toContractId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'To digital account'
     */
    readonly toDigitalAccountId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'To document'
     */
    readonly toDocumentId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'To event'
     */
    readonly toEventId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'To evidence item'
     */
    readonly toEvidenceItemId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'To facility'
     */
    readonly toFacilityId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'To firearm'
     */
    readonly toFirearmId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'To hauler'
     */
    readonly toHaulerId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'To id'
     */
    readonly toId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'To incident'
     */
    readonly toIncidentId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'To inspection'
     */
    readonly toInspectionId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'To lgu'
     */
    readonly toLGUId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'To location'
     */
    readonly toLocationId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'To online group'
     */
    readonly toOnlineGroupId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'To organization'
     */
    readonly toOrganizationId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'To person'
     */
    readonly toPersonId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'To school'
     */
    readonly toSchoolId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'To other thing'
     */
    readonly toThingId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'To type'
     */
    readonly toType: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'To vehicle'
     */
    readonly toVehicleId: $PropType['string'] | undefined;
  }
  export type StrictProps = Props;

  export interface ObjectSet extends $ObjectSet<Relationship, Relationship.ObjectSet> {}

  export type OsdkInstance<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Relationship.Props = keyof Relationship.Props,
  > = $Osdk.Instance<Relationship, OPTIONS, K>;

  /** @deprecated use OsdkInstance */
  export type OsdkObject<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Relationship.Props = keyof Relationship.Props,
  > = OsdkInstance<OPTIONS, K>;
}

export interface Relationship extends $ObjectTypeDefinition {
  osdkMetadata: typeof $osdkMetadata;
  type: 'object';
  apiName: 'Relationship';
  primaryKeyApiName: 'relationshipId';
  primaryKeyType: 'string';
  __DefinitionMetadata?: {
    objectSet: Relationship.ObjectSet;
    props: Relationship.Props;
    linksType: Relationship.Links;
    strictProps: Relationship.StrictProps;
    apiName: 'Relationship';
    description: undefined;
    displayName: 'Relationship';
    icon: {
      type: 'blueprint';
      color: '#2D72D2';
      name: 'cube';
    };
    implements: [];
    interfaceMap: {};
    inverseInterfaceMap: {};
    links: {
      fromBarangay: $ObjectMetadata.Link<Barangay, false>;
      fromComplaint: $ObjectMetadata.Link<Complaint, false>;
      fromContract: $ObjectMetadata.Link<Contract, false>;
      fromDigitalAccount: $ObjectMetadata.Link<DigitalAccount, false>;
      fromDocument: $ObjectMetadata.Link<Document, false>;
      fromEvent: $ObjectMetadata.Link<Event, false>;
      fromEvidenceItem: $ObjectMetadata.Link<EvidenceItem, false>;
      fromFacility: $ObjectMetadata.Link<Facility, false>;
      fromFirearm: $ObjectMetadata.Link<Firearm, false>;
      fromHauler: $ObjectMetadata.Link<Hauler, false>;
      fromIncident: $ObjectMetadata.Link<Incident, false>;
      fromInspection: $ObjectMetadata.Link<Inspection, false>;
      fromLGU: $ObjectMetadata.Link<LGU, false>;
      fromLocation: $ObjectMetadata.Link<Location, false>;
      fromOnlineGroup: $ObjectMetadata.Link<OnlineGroup, false>;
      fromOrganization: $ObjectMetadata.Link<Organization, false>;
      fromPerson: $ObjectMetadata.Link<Person, false>;
      fromSchool: $ObjectMetadata.Link<School, false>;
      fromThing: $ObjectMetadata.Link<Thing, false>;
      fromVehicle: $ObjectMetadata.Link<Vehicle, false>;
      toBarangay: $ObjectMetadata.Link<Barangay, false>;
      toComplaint: $ObjectMetadata.Link<Complaint, false>;
      toContract: $ObjectMetadata.Link<Contract, false>;
      toDigitalAccount: $ObjectMetadata.Link<DigitalAccount, false>;
      toDocument: $ObjectMetadata.Link<Document, false>;
      toEvent: $ObjectMetadata.Link<Event, false>;
      toEvidenceItem: $ObjectMetadata.Link<EvidenceItem, false>;
      toFacility: $ObjectMetadata.Link<Facility, false>;
      toFirearm: $ObjectMetadata.Link<Firearm, false>;
      toHauler: $ObjectMetadata.Link<Hauler, false>;
      toIncident: $ObjectMetadata.Link<Incident, false>;
      toInspection: $ObjectMetadata.Link<Inspection, false>;
      toLGU: $ObjectMetadata.Link<LGU, false>;
      toLocation: $ObjectMetadata.Link<Location, false>;
      toOnlineGroup: $ObjectMetadata.Link<OnlineGroup, false>;
      toOrganization: $ObjectMetadata.Link<Organization, false>;
      toPerson: $ObjectMetadata.Link<Person, false>;
      toSchool: $ObjectMetadata.Link<School, false>;
      toThing: $ObjectMetadata.Link<Thing, false>;
      toVehicle: $ObjectMetadata.Link<Vehicle, false>;
    };
    pluralDisplayName: 'Relationships';
    primaryKeyApiName: 'relationshipId';
    primaryKeyType: 'string';
    properties: {
      /**
       *   property status: active
       *
       *   display name: 'Confidence'
       */
      confidence: $PropertyDef<'double', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'From barangay'
       */
      fromBarangayId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'From complaint'
       */
      fromComplaintId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'From contract'
       */
      fromContractId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'From digital account'
       */
      fromDigitalAccountId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'From document'
       */
      fromDocumentId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'From event'
       */
      fromEventId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'From evidence item'
       */
      fromEvidenceItemId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'From facility'
       */
      fromFacilityId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'From firearm'
       */
      fromFirearmId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'From hauler'
       */
      fromHaulerId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'From id'
       */
      fromId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'From incident'
       */
      fromIncidentId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'From inspection'
       */
      fromInspectionId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'From lgu'
       */
      fromLGUId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'From location'
       */
      fromLocationId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'From online group'
       */
      fromOnlineGroupId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'From organization'
       */
      fromOrganizationId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'From person'
       */
      fromPersonId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'From school'
       */
      fromSchoolId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'From other thing'
       */
      fromThingId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'From type'
       */
      fromType: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'From vehicle'
       */
      fromVehicleId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Kind'
       */
      kind: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Kind, as written'
       */
      kindLabel: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Label'
       */
      label: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Method'
       */
      method: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Observed at'
       */
      observedAt: $PropertyDef<'timestamp', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Passages'
       */
      passageIds: $PropertyDef<'string', 'nullable', 'array'>;
      /**
       *   property status: active
       *
       *   display name: 'Source records'
       */
      recordIds: $PropertyDef<'string', 'nullable', 'array'>;
      /**
       *   property status: active
       *
       *   display name: 'Relationship id'
       */
      relationshipId: $PropertyDef<'string', 'non-nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Review note'
       */
      reviewNote: $PropertyDef<'string', 'nullable', 'single'>;
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
      /**
       *   property status: active
       *
       *   display name: 'To barangay'
       */
      toBarangayId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'To complaint'
       */
      toComplaintId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'To contract'
       */
      toContractId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'To digital account'
       */
      toDigitalAccountId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'To document'
       */
      toDocumentId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'To event'
       */
      toEventId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'To evidence item'
       */
      toEvidenceItemId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'To facility'
       */
      toFacilityId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'To firearm'
       */
      toFirearmId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'To hauler'
       */
      toHaulerId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'To id'
       */
      toId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'To incident'
       */
      toIncidentId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'To inspection'
       */
      toInspectionId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'To lgu'
       */
      toLGUId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'To location'
       */
      toLocationId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'To online group'
       */
      toOnlineGroupId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'To organization'
       */
      toOrganizationId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'To person'
       */
      toPersonId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'To school'
       */
      toSchoolId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'To other thing'
       */
      toThingId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'To type'
       */
      toType: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'To vehicle'
       */
      toVehicleId: $PropertyDef<'string', 'nullable', 'single'>;
    };
    rid: 'ri.Relationship';
    status: 'ACTIVE';
    titleProperty: 'label';
    type: 'object';
    visibility: undefined;
  };
}

export const Relationship = {
  type: 'object',
  apiName: 'Relationship',
  osdkMetadata: $osdkMetadata,
  primaryKeyApiName: 'relationshipId',
  primaryKeyType: 'string',
  internalDoNotUseMetadata: {
    rid: 'ri.Relationship',
  },
} satisfies Relationship & { internalDoNotUseMetadata: { rid: string } } as Relationship;
