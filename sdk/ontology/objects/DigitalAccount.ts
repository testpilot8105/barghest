import type { PropertyDef as $PropertyDef } from '@osdk/client';
import { $osdkMetadata } from '../../OntologyMetadata.js';
import type { $ExpectedClientVersion } from '../../OntologyMetadata.js';
import type { Person } from './Person.js';
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

export namespace DigitalAccount {
  export type PropertyKeys =
    | 'accountId'
    | 'canonicalId'
    | 'displayName'
    | 'handle'
    | 'passageId'
    | 'personId'
    | 'platform'
    | 'platformId'
    | 'recordId'
    | 'scenario';

  export interface Links {
    readonly candidates: DigitalAccount.ObjectSet;
    readonly canonical: $SingleLinkAccessor<DigitalAccount>;
    readonly owner: $SingleLinkAccessor<Person>;
    readonly passage: $SingleLinkAccessor<Passage>;
    readonly relationshipsFrom: Relationship.ObjectSet;
    readonly relationshipsTo: Relationship.ObjectSet;
    readonly sourceRecord: $SingleLinkAccessor<SourceRecord>;
  }

  export interface Props {
    /**
     *   property status: active
     *
     *   display name: 'Account id'
     */
    readonly accountId: $PropType['string'];
    /**
     *   property status: active
     *
     *   display name: 'Canonical object'
     */
    readonly canonicalId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Display name'
     */
    readonly displayName: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Handle'
     */
    readonly handle: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Passage'
     */
    readonly passageId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Owner'
     */
    readonly personId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Platform'
     */
    readonly platform: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Platform user id'
     */
    readonly platformId: $PropType['string'] | undefined;
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
  }
  export type StrictProps = Props;

  export interface ObjectSet extends $ObjectSet<DigitalAccount, DigitalAccount.ObjectSet> {}

  export type OsdkInstance<
    OPTIONS extends never | '$rid' = never,
    K extends keyof DigitalAccount.Props = keyof DigitalAccount.Props,
  > = $Osdk.Instance<DigitalAccount, OPTIONS, K>;

  /** @deprecated use OsdkInstance */
  export type OsdkObject<
    OPTIONS extends never | '$rid' = never,
    K extends keyof DigitalAccount.Props = keyof DigitalAccount.Props,
  > = OsdkInstance<OPTIONS, K>;
}

export interface DigitalAccount extends $ObjectTypeDefinition {
  osdkMetadata: typeof $osdkMetadata;
  type: 'object';
  apiName: 'DigitalAccount';
  primaryKeyApiName: 'accountId';
  primaryKeyType: 'string';
  __DefinitionMetadata?: {
    objectSet: DigitalAccount.ObjectSet;
    props: DigitalAccount.Props;
    linksType: DigitalAccount.Links;
    strictProps: DigitalAccount.StrictProps;
    apiName: 'DigitalAccount';
    description: undefined;
    displayName: 'Digital account';
    icon: {
      type: 'blueprint';
      color: '#2D72D2';
      name: 'cube';
    };
    implements: [];
    interfaceMap: {};
    inverseInterfaceMap: {};
    links: {
      candidates: $ObjectMetadata.Link<DigitalAccount, true>;
      canonical: $ObjectMetadata.Link<DigitalAccount, false>;
      owner: $ObjectMetadata.Link<Person, false>;
      passage: $ObjectMetadata.Link<Passage, false>;
      relationshipsFrom: $ObjectMetadata.Link<Relationship, true>;
      relationshipsTo: $ObjectMetadata.Link<Relationship, true>;
      sourceRecord: $ObjectMetadata.Link<SourceRecord, false>;
    };
    pluralDisplayName: 'Digital accounts';
    primaryKeyApiName: 'accountId';
    primaryKeyType: 'string';
    properties: {
      /**
       *   property status: active
       *
       *   display name: 'Account id'
       */
      accountId: $PropertyDef<'string', 'non-nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Canonical object'
       */
      canonicalId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Display name'
       */
      displayName: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Handle'
       */
      handle: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Passage'
       */
      passageId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Owner'
       */
      personId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Platform'
       */
      platform: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Platform user id'
       */
      platformId: $PropertyDef<'string', 'nullable', 'single'>;
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
    };
    rid: 'ri.DigitalAccount';
    status: 'ACTIVE';
    titleProperty: 'handle';
    type: 'object';
    visibility: undefined;
  };
}

export const DigitalAccount = {
  type: 'object',
  apiName: 'DigitalAccount',
  osdkMetadata: $osdkMetadata,
  primaryKeyApiName: 'accountId',
  primaryKeyType: 'string',
  internalDoNotUseMetadata: {
    rid: 'ri.DigitalAccount',
  },
} satisfies DigitalAccount & { internalDoNotUseMetadata: { rid: string } } as DigitalAccount;
