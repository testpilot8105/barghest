import type { PropertyDef as $PropertyDef } from '@osdk/client';
import { $osdkMetadata } from '../../OntologyMetadata.js';
import type { $ExpectedClientVersion } from '../../OntologyMetadata.js';
import type { LGU } from './LGU.js';
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

export namespace Contract {
  export type PropertyKeys =
    | 'amount'
    | 'canonicalId'
    | 'contractId'
    | 'contractNo'
    | 'endAt'
    | 'haulerId'
    | 'lguId'
    | 'passageId'
    | 'photoId'
    | 'recordId'
    | 'scenario'
    | 'scope'
    | 'startAt';

  export interface Links {
    readonly candidates: Contract.ObjectSet;
    readonly canonical: $SingleLinkAccessor<Contract>;
    readonly hauler: $SingleLinkAccessor<Hauler>;
    readonly lgu: $SingleLinkAccessor<LGU>;
    readonly passage: $SingleLinkAccessor<Passage>;
    readonly relationshipsFrom: Relationship.ObjectSet;
    readonly relationshipsTo: Relationship.ObjectSet;
    readonly sourceRecord: $SingleLinkAccessor<SourceRecord>;
  }

  export interface Props {
    /**
     *   property status: active
     *
     *   display name: 'Amount'
     */
    readonly amount: $PropType['double'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Canonical object'
     */
    readonly canonicalId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Contract id'
     */
    readonly contractId: $PropType['string'];
    /**
     *   property status: active
     *
     *   display name: 'Contract no.'
     */
    readonly contractNo: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'End'
     */
    readonly endAt: $PropType['timestamp'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Hauler'
     */
    readonly haulerId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'LGU'
     */
    readonly lguId: $PropType['string'] | undefined;
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
     *   display name: 'Scope'
     */
    readonly scope: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Start'
     */
    readonly startAt: $PropType['timestamp'] | undefined;
  }
  export type StrictProps = Props;

  export interface ObjectSet extends $ObjectSet<Contract, Contract.ObjectSet> {}

  export type OsdkInstance<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Contract.Props = keyof Contract.Props,
  > = $Osdk.Instance<Contract, OPTIONS, K>;

  /** @deprecated use OsdkInstance */
  export type OsdkObject<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Contract.Props = keyof Contract.Props,
  > = OsdkInstance<OPTIONS, K>;
}

export interface Contract extends $ObjectTypeDefinition {
  osdkMetadata: typeof $osdkMetadata;
  type: 'object';
  apiName: 'Contract';
  primaryKeyApiName: 'contractId';
  primaryKeyType: 'string';
  __DefinitionMetadata?: {
    objectSet: Contract.ObjectSet;
    props: Contract.Props;
    linksType: Contract.Links;
    strictProps: Contract.StrictProps;
    apiName: 'Contract';
    description: undefined;
    displayName: 'Contract';
    icon: {
      type: 'blueprint';
      color: '#2D72D2';
      name: 'cube';
    };
    implements: [];
    interfaceMap: {};
    inverseInterfaceMap: {};
    links: {
      candidates: $ObjectMetadata.Link<Contract, true>;
      canonical: $ObjectMetadata.Link<Contract, false>;
      hauler: $ObjectMetadata.Link<Hauler, false>;
      lgu: $ObjectMetadata.Link<LGU, false>;
      passage: $ObjectMetadata.Link<Passage, false>;
      relationshipsFrom: $ObjectMetadata.Link<Relationship, true>;
      relationshipsTo: $ObjectMetadata.Link<Relationship, true>;
      sourceRecord: $ObjectMetadata.Link<SourceRecord, false>;
    };
    pluralDisplayName: 'Contracts';
    primaryKeyApiName: 'contractId';
    primaryKeyType: 'string';
    properties: {
      /**
       *   property status: active
       *
       *   display name: 'Amount'
       */
      amount: $PropertyDef<'double', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Canonical object'
       */
      canonicalId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Contract id'
       */
      contractId: $PropertyDef<'string', 'non-nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Contract no.'
       */
      contractNo: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'End'
       */
      endAt: $PropertyDef<'timestamp', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Hauler'
       */
      haulerId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'LGU'
       */
      lguId: $PropertyDef<'string', 'nullable', 'single'>;
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
       *   display name: 'Scope'
       */
      scope: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Start'
       */
      startAt: $PropertyDef<'timestamp', 'nullable', 'single'>;
    };
    rid: 'ri.Contract';
    status: 'ACTIVE';
    titleProperty: 'contractNo';
    type: 'object';
    visibility: undefined;
  };
}

export const Contract = {
  type: 'object',
  apiName: 'Contract',
  osdkMetadata: $osdkMetadata,
  primaryKeyApiName: 'contractId',
  primaryKeyType: 'string',
  internalDoNotUseMetadata: {
    rid: 'ri.Contract',
  },
} satisfies Contract & { internalDoNotUseMetadata: { rid: string } } as Contract;
