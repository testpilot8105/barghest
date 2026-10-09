import type { PropertyDef as $PropertyDef } from '@osdk/client';
import { $osdkMetadata } from '../../OntologyMetadata.js';
import type { $ExpectedClientVersion } from '../../OntologyMetadata.js';
import type { Firearm } from './Firearm.js';
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

export namespace EvidenceItem {
  export type PropertyKeys =
    | 'canonicalId'
    | 'custodyStatus'
    | 'evidenceId'
    | 'incidentId'
    | 'kind'
    | 'matchedFirearmId'
    | 'passageId'
    | 'recordId'
    | 'scenario'
    | 'tag';

  export interface Links {
    readonly candidates: EvidenceItem.ObjectSet;
    readonly canonical: $SingleLinkAccessor<EvidenceItem>;
    readonly matchedTo: $SingleLinkAccessor<Firearm>;
    readonly passage: $SingleLinkAccessor<Passage>;
    readonly recoveredAt: $SingleLinkAccessor<Incident>;
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
     *   display name: 'Custody status'
     */
    readonly custodyStatus: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Evidence id'
     */
    readonly evidenceId: $PropType['string'];
    /**
     *   property status: active
     *
     *   display name: 'Recovered at'
     */
    readonly incidentId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Kind'
     */
    readonly kind: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Matched firearm'
     */
    readonly matchedFirearmId: $PropType['string'] | undefined;
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
     *   display name: 'Tag'
     */
    readonly tag: $PropType['string'] | undefined;
  }
  export type StrictProps = Props;

  export interface ObjectSet extends $ObjectSet<EvidenceItem, EvidenceItem.ObjectSet> {}

  export type OsdkInstance<
    OPTIONS extends never | '$rid' = never,
    K extends keyof EvidenceItem.Props = keyof EvidenceItem.Props,
  > = $Osdk.Instance<EvidenceItem, OPTIONS, K>;

  /** @deprecated use OsdkInstance */
  export type OsdkObject<
    OPTIONS extends never | '$rid' = never,
    K extends keyof EvidenceItem.Props = keyof EvidenceItem.Props,
  > = OsdkInstance<OPTIONS, K>;
}

export interface EvidenceItem extends $ObjectTypeDefinition {
  osdkMetadata: typeof $osdkMetadata;
  type: 'object';
  apiName: 'EvidenceItem';
  primaryKeyApiName: 'evidenceId';
  primaryKeyType: 'string';
  __DefinitionMetadata?: {
    objectSet: EvidenceItem.ObjectSet;
    props: EvidenceItem.Props;
    linksType: EvidenceItem.Links;
    strictProps: EvidenceItem.StrictProps;
    apiName: 'EvidenceItem';
    description: undefined;
    displayName: 'Evidence item';
    icon: {
      type: 'blueprint';
      color: '#2D72D2';
      name: 'cube';
    };
    implements: [];
    interfaceMap: {};
    inverseInterfaceMap: {};
    links: {
      candidates: $ObjectMetadata.Link<EvidenceItem, true>;
      canonical: $ObjectMetadata.Link<EvidenceItem, false>;
      matchedTo: $ObjectMetadata.Link<Firearm, false>;
      passage: $ObjectMetadata.Link<Passage, false>;
      recoveredAt: $ObjectMetadata.Link<Incident, false>;
      relationshipsFrom: $ObjectMetadata.Link<Relationship, true>;
      relationshipsTo: $ObjectMetadata.Link<Relationship, true>;
      sourceRecord: $ObjectMetadata.Link<SourceRecord, false>;
    };
    pluralDisplayName: 'Evidence items';
    primaryKeyApiName: 'evidenceId';
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
       *   display name: 'Custody status'
       */
      custodyStatus: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Evidence id'
       */
      evidenceId: $PropertyDef<'string', 'non-nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Recovered at'
       */
      incidentId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Kind'
       */
      kind: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Matched firearm'
       */
      matchedFirearmId: $PropertyDef<'string', 'nullable', 'single'>;
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
       *   display name: 'Tag'
       */
      tag: $PropertyDef<'string', 'nullable', 'single'>;
    };
    rid: 'ri.EvidenceItem';
    status: 'ACTIVE';
    titleProperty: 'tag';
    type: 'object';
    visibility: undefined;
  };
}

export const EvidenceItem = {
  type: 'object',
  apiName: 'EvidenceItem',
  osdkMetadata: $osdkMetadata,
  primaryKeyApiName: 'evidenceId',
  primaryKeyType: 'string',
  internalDoNotUseMetadata: {
    rid: 'ri.EvidenceItem',
  },
} satisfies EvidenceItem & { internalDoNotUseMetadata: { rid: string } } as EvidenceItem;
