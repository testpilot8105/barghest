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

export namespace SourceRecord {
  export type PropertyKeys = 'documentId' | 'label' | 'observedAt' | 'rawJson' | 'recordId' | 'system';

  export interface Links {
    readonly document: $SingleLinkAccessor<Document>;
    readonly recordedBarangays: Barangay.ObjectSet;
    readonly recordedComplaints: Complaint.ObjectSet;
    readonly recordedContracts: Contract.ObjectSet;
    readonly recordedDigitalAccounts: DigitalAccount.ObjectSet;
    readonly recordedEvents: Event.ObjectSet;
    readonly recordedEvidenceItems: EvidenceItem.ObjectSet;
    readonly recordedFacilities: Facility.ObjectSet;
    readonly recordedFirearms: Firearm.ObjectSet;
    readonly recordedHaulers: Hauler.ObjectSet;
    readonly recordedIncidents: Incident.ObjectSet;
    readonly recordedInspections: Inspection.ObjectSet;
    readonly recordedLgus: LGU.ObjectSet;
    readonly recordedLocations: Location.ObjectSet;
    readonly recordedOnlineGroups: OnlineGroup.ObjectSet;
    readonly recordedOrganizations: Organization.ObjectSet;
    readonly recordedPeople: Person.ObjectSet;
    readonly recordedSchools: School.ObjectSet;
    readonly recordedThings: Thing.ObjectSet;
    readonly recordedVehicles: Vehicle.ObjectSet;
  }

  export interface Props {
    /**
     *   property status: active
     *
     *   display name: 'Document'
     */
    readonly documentId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Label'
     */
    readonly label: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Observed at'
     */
    readonly observedAt: $PropType['timestamp'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Raw row (JSON)'
     */
    readonly rawJson: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Record id'
     */
    readonly recordId: $PropType['string'];
    /**
     *   property status: active
     *
     *   display name: 'Source system'
     */
    readonly system: $PropType['string'] | undefined;
  }
  export type StrictProps = Props;

  export interface ObjectSet extends $ObjectSet<SourceRecord, SourceRecord.ObjectSet> {}

  export type OsdkInstance<
    OPTIONS extends never | '$rid' = never,
    K extends keyof SourceRecord.Props = keyof SourceRecord.Props,
  > = $Osdk.Instance<SourceRecord, OPTIONS, K>;

  /** @deprecated use OsdkInstance */
  export type OsdkObject<
    OPTIONS extends never | '$rid' = never,
    K extends keyof SourceRecord.Props = keyof SourceRecord.Props,
  > = OsdkInstance<OPTIONS, K>;
}

export interface SourceRecord extends $ObjectTypeDefinition {
  osdkMetadata: typeof $osdkMetadata;
  type: 'object';
  apiName: 'SourceRecord';
  primaryKeyApiName: 'recordId';
  primaryKeyType: 'string';
  __DefinitionMetadata?: {
    objectSet: SourceRecord.ObjectSet;
    props: SourceRecord.Props;
    linksType: SourceRecord.Links;
    strictProps: SourceRecord.StrictProps;
    apiName: 'SourceRecord';
    description: undefined;
    displayName: 'Source record';
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
      recordedBarangays: $ObjectMetadata.Link<Barangay, true>;
      recordedComplaints: $ObjectMetadata.Link<Complaint, true>;
      recordedContracts: $ObjectMetadata.Link<Contract, true>;
      recordedDigitalAccounts: $ObjectMetadata.Link<DigitalAccount, true>;
      recordedEvents: $ObjectMetadata.Link<Event, true>;
      recordedEvidenceItems: $ObjectMetadata.Link<EvidenceItem, true>;
      recordedFacilities: $ObjectMetadata.Link<Facility, true>;
      recordedFirearms: $ObjectMetadata.Link<Firearm, true>;
      recordedHaulers: $ObjectMetadata.Link<Hauler, true>;
      recordedIncidents: $ObjectMetadata.Link<Incident, true>;
      recordedInspections: $ObjectMetadata.Link<Inspection, true>;
      recordedLgus: $ObjectMetadata.Link<LGU, true>;
      recordedLocations: $ObjectMetadata.Link<Location, true>;
      recordedOnlineGroups: $ObjectMetadata.Link<OnlineGroup, true>;
      recordedOrganizations: $ObjectMetadata.Link<Organization, true>;
      recordedPeople: $ObjectMetadata.Link<Person, true>;
      recordedSchools: $ObjectMetadata.Link<School, true>;
      recordedThings: $ObjectMetadata.Link<Thing, true>;
      recordedVehicles: $ObjectMetadata.Link<Vehicle, true>;
    };
    pluralDisplayName: 'Source records';
    primaryKeyApiName: 'recordId';
    primaryKeyType: 'string';
    properties: {
      /**
       *   property status: active
       *
       *   display name: 'Document'
       */
      documentId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Label'
       */
      label: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Observed at'
       */
      observedAt: $PropertyDef<'timestamp', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Raw row (JSON)'
       */
      rawJson: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Record id'
       */
      recordId: $PropertyDef<'string', 'non-nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Source system'
       */
      system: $PropertyDef<'string', 'nullable', 'single'>;
    };
    rid: 'ri.SourceRecord';
    status: 'ACTIVE';
    titleProperty: 'label';
    type: 'object';
    visibility: undefined;
  };
}

export const SourceRecord = {
  type: 'object',
  apiName: 'SourceRecord',
  osdkMetadata: $osdkMetadata,
  primaryKeyApiName: 'recordId',
  primaryKeyType: 'string',
  internalDoNotUseMetadata: {
    rid: 'ri.SourceRecord',
  },
} satisfies SourceRecord & { internalDoNotUseMetadata: { rid: string } } as SourceRecord;
