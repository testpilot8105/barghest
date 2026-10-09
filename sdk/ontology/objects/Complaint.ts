import type { PropertyDef as $PropertyDef } from '@osdk/client';
import { $osdkMetadata } from '../../OntologyMetadata.js';
import type { $ExpectedClientVersion } from '../../OntologyMetadata.js';
import type { Barangay } from './Barangay.js';
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

export namespace Complaint {
  export type PropertyKeys =
    | 'barangayId'
    | 'canonicalId'
    | 'category'
    | 'channel'
    | 'complaintId'
    | 'filedAt'
    | 'label'
    | 'passageId'
    | 'photoId'
    | 'recordId'
    | 'scenario';

  export interface Links {
    readonly barangay: $SingleLinkAccessor<Barangay>;
    readonly candidates: Complaint.ObjectSet;
    readonly canonical: $SingleLinkAccessor<Complaint>;
    readonly passage: $SingleLinkAccessor<Passage>;
    readonly relationshipsFrom: Relationship.ObjectSet;
    readonly relationshipsTo: Relationship.ObjectSet;
    readonly sourceRecord: $SingleLinkAccessor<SourceRecord>;
  }

  export interface Props {
    /**
     *   property status: active
     *
     *   display name: 'Barangay'
     */
    readonly barangayId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Canonical object'
     */
    readonly canonicalId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Category'
     */
    readonly category: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Channel'
     */
    readonly channel: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Complaint id'
     */
    readonly complaintId: $PropType['string'];
    /**
     *   property status: active
     *
     *   display name: 'Filed at'
     */
    readonly filedAt: $PropType['timestamp'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Label'
     */
    readonly label: $PropType['string'] | undefined;
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
  }
  export type StrictProps = Props;

  export interface ObjectSet extends $ObjectSet<Complaint, Complaint.ObjectSet> {}

  export type OsdkInstance<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Complaint.Props = keyof Complaint.Props,
  > = $Osdk.Instance<Complaint, OPTIONS, K>;

  /** @deprecated use OsdkInstance */
  export type OsdkObject<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Complaint.Props = keyof Complaint.Props,
  > = OsdkInstance<OPTIONS, K>;
}

export interface Complaint extends $ObjectTypeDefinition {
  osdkMetadata: typeof $osdkMetadata;
  type: 'object';
  apiName: 'Complaint';
  primaryKeyApiName: 'complaintId';
  primaryKeyType: 'string';
  __DefinitionMetadata?: {
    objectSet: Complaint.ObjectSet;
    props: Complaint.Props;
    linksType: Complaint.Links;
    strictProps: Complaint.StrictProps;
    apiName: 'Complaint';
    description: undefined;
    displayName: 'Complaint';
    icon: {
      type: 'blueprint';
      color: '#2D72D2';
      name: 'cube';
    };
    implements: [];
    interfaceMap: {};
    inverseInterfaceMap: {};
    links: {
      barangay: $ObjectMetadata.Link<Barangay, false>;
      candidates: $ObjectMetadata.Link<Complaint, true>;
      canonical: $ObjectMetadata.Link<Complaint, false>;
      passage: $ObjectMetadata.Link<Passage, false>;
      relationshipsFrom: $ObjectMetadata.Link<Relationship, true>;
      relationshipsTo: $ObjectMetadata.Link<Relationship, true>;
      sourceRecord: $ObjectMetadata.Link<SourceRecord, false>;
    };
    pluralDisplayName: 'Complaints';
    primaryKeyApiName: 'complaintId';
    primaryKeyType: 'string';
    properties: {
      /**
       *   property status: active
       *
       *   display name: 'Barangay'
       */
      barangayId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Canonical object'
       */
      canonicalId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Category'
       */
      category: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Channel'
       */
      channel: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Complaint id'
       */
      complaintId: $PropertyDef<'string', 'non-nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Filed at'
       */
      filedAt: $PropertyDef<'timestamp', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Label'
       */
      label: $PropertyDef<'string', 'nullable', 'single'>;
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
    };
    rid: 'ri.Complaint';
    status: 'ACTIVE';
    titleProperty: 'label';
    type: 'object';
    visibility: undefined;
  };
}

export const Complaint = {
  type: 'object',
  apiName: 'Complaint',
  osdkMetadata: $osdkMetadata,
  primaryKeyApiName: 'complaintId',
  primaryKeyType: 'string',
  internalDoNotUseMetadata: {
    rid: 'ri.Complaint',
  },
} satisfies Complaint & { internalDoNotUseMetadata: { rid: string } } as Complaint;
