import type { PropertyDef as $PropertyDef } from '@osdk/client';
import { $osdkMetadata } from '../../OntologyMetadata.js';
import type { $ExpectedClientVersion } from '../../OntologyMetadata.js';
import type { Person } from './Person.js';
import type { Organization } from './Organization.js';
import type { EvidenceItem } from './EvidenceItem.js';
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

export namespace Firearm {
  export type PropertyKeys =
    | 'calibre'
    | 'canonicalId'
    | 'custodianId'
    | 'feoRegistrationNo'
    | 'firearmId'
    | 'label'
    | 'make'
    | 'model'
    | 'passageId'
    | 'recordId'
    | 'registeredAgencyId'
    | 'registeredToId'
    | 'scenario'
    | 'serial'
    | 'storage';

  export interface Links {
    readonly candidates: Firearm.ObjectSet;
    readonly canonical: $SingleLinkAccessor<Firearm>;
    readonly custodian: $SingleLinkAccessor<Person>;
    readonly evidenceItems: EvidenceItem.ObjectSet;
    readonly passage: $SingleLinkAccessor<Passage>;
    readonly registeredAgency: $SingleLinkAccessor<Organization>;
    readonly registeredTo: $SingleLinkAccessor<Person>;
    readonly relationshipsFrom: Relationship.ObjectSet;
    readonly relationshipsTo: Relationship.ObjectSet;
    readonly sourceRecord: $SingleLinkAccessor<SourceRecord>;
  }

  export interface Props {
    /**
     *   property status: active
     *
     *   display name: 'Calibre'
     */
    readonly calibre: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Canonical object'
     */
    readonly canonicalId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Custodian'
     */
    readonly custodianId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'FEO registration no.'
     */
    readonly feoRegistrationNo: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Firearm id'
     */
    readonly firearmId: $PropType['string'];
    /**
     *   property status: active
     *
     *   display name: 'Label'
     */
    readonly label: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Make'
     */
    readonly make: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Model'
     */
    readonly model: $PropType['string'] | undefined;
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
     *   display name: 'Registered agency'
     */
    readonly registeredAgencyId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Registered to (person)'
     */
    readonly registeredToId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Investigation'
     */
    readonly scenario: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Serial number'
     */
    readonly serial: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Storage'
     */
    readonly storage: $PropType['string'] | undefined;
  }
  export type StrictProps = Props;

  export interface ObjectSet extends $ObjectSet<Firearm, Firearm.ObjectSet> {}

  export type OsdkInstance<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Firearm.Props = keyof Firearm.Props,
  > = $Osdk.Instance<Firearm, OPTIONS, K>;

  /** @deprecated use OsdkInstance */
  export type OsdkObject<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Firearm.Props = keyof Firearm.Props,
  > = OsdkInstance<OPTIONS, K>;
}

export interface Firearm extends $ObjectTypeDefinition {
  osdkMetadata: typeof $osdkMetadata;
  type: 'object';
  apiName: 'Firearm';
  primaryKeyApiName: 'firearmId';
  primaryKeyType: 'string';
  __DefinitionMetadata?: {
    objectSet: Firearm.ObjectSet;
    props: Firearm.Props;
    linksType: Firearm.Links;
    strictProps: Firearm.StrictProps;
    apiName: 'Firearm';
    description: undefined;
    displayName: 'Firearm';
    icon: {
      type: 'blueprint';
      color: '#2D72D2';
      name: 'cube';
    };
    implements: [];
    interfaceMap: {};
    inverseInterfaceMap: {};
    links: {
      candidates: $ObjectMetadata.Link<Firearm, true>;
      canonical: $ObjectMetadata.Link<Firearm, false>;
      custodian: $ObjectMetadata.Link<Person, false>;
      evidenceItems: $ObjectMetadata.Link<EvidenceItem, true>;
      passage: $ObjectMetadata.Link<Passage, false>;
      registeredAgency: $ObjectMetadata.Link<Organization, false>;
      registeredTo: $ObjectMetadata.Link<Person, false>;
      relationshipsFrom: $ObjectMetadata.Link<Relationship, true>;
      relationshipsTo: $ObjectMetadata.Link<Relationship, true>;
      sourceRecord: $ObjectMetadata.Link<SourceRecord, false>;
    };
    pluralDisplayName: 'Firearms';
    primaryKeyApiName: 'firearmId';
    primaryKeyType: 'string';
    properties: {
      /**
       *   property status: active
       *
       *   display name: 'Calibre'
       */
      calibre: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Canonical object'
       */
      canonicalId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Custodian'
       */
      custodianId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'FEO registration no.'
       */
      feoRegistrationNo: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Firearm id'
       */
      firearmId: $PropertyDef<'string', 'non-nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Label'
       */
      label: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Make'
       */
      make: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Model'
       */
      model: $PropertyDef<'string', 'nullable', 'single'>;
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
       *   display name: 'Registered agency'
       */
      registeredAgencyId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Registered to (person)'
       */
      registeredToId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Investigation'
       */
      scenario: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Serial number'
       */
      serial: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Storage'
       */
      storage: $PropertyDef<'string', 'nullable', 'single'>;
    };
    rid: 'ri.Firearm';
    status: 'ACTIVE';
    titleProperty: 'label';
    type: 'object';
    visibility: undefined;
  };
}

export const Firearm = {
  type: 'object',
  apiName: 'Firearm',
  osdkMetadata: $osdkMetadata,
  primaryKeyApiName: 'firearmId',
  primaryKeyType: 'string',
  internalDoNotUseMetadata: {
    rid: 'ri.Firearm',
  },
} satisfies Firearm & { internalDoNotUseMetadata: { rid: string } } as Firearm;
