import type { PropertyDef as $PropertyDef } from '@osdk/client';
import { $osdkMetadata } from '../../OntologyMetadata.js';
import type { $ExpectedClientVersion } from '../../OntologyMetadata.js';
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

export namespace OnlineGroup {
  export type PropertyKeys =
    | 'canonicalId'
    | 'channels'
    | 'groupId'
    | 'name'
    | 'passageId'
    | 'platform'
    | 'platformId'
    | 'recordId'
    | 'scenario';

  export interface Links {
    readonly candidates: OnlineGroup.ObjectSet;
    readonly canonical: $SingleLinkAccessor<OnlineGroup>;
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
     *   display name: 'Channels'
     */
    readonly channels: $PropType['string'][] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Group id'
     */
    readonly groupId: $PropType['string'];
    /**
     *   property status: active
     *
     *   display name: 'Name'
     */
    readonly name: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Passage'
     */
    readonly passageId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Platform'
     */
    readonly platform: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Platform group id'
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
     *   display name: 'Investigation'
     */
    readonly scenario: $PropType['string'] | undefined;
  }
  export type StrictProps = Props;

  export interface ObjectSet extends $ObjectSet<OnlineGroup, OnlineGroup.ObjectSet> {}

  export type OsdkInstance<
    OPTIONS extends never | '$rid' = never,
    K extends keyof OnlineGroup.Props = keyof OnlineGroup.Props,
  > = $Osdk.Instance<OnlineGroup, OPTIONS, K>;

  /** @deprecated use OsdkInstance */
  export type OsdkObject<
    OPTIONS extends never | '$rid' = never,
    K extends keyof OnlineGroup.Props = keyof OnlineGroup.Props,
  > = OsdkInstance<OPTIONS, K>;
}

export interface OnlineGroup extends $ObjectTypeDefinition {
  osdkMetadata: typeof $osdkMetadata;
  type: 'object';
  apiName: 'OnlineGroup';
  primaryKeyApiName: 'groupId';
  primaryKeyType: 'string';
  __DefinitionMetadata?: {
    objectSet: OnlineGroup.ObjectSet;
    props: OnlineGroup.Props;
    linksType: OnlineGroup.Links;
    strictProps: OnlineGroup.StrictProps;
    apiName: 'OnlineGroup';
    description: undefined;
    displayName: 'Online group';
    icon: {
      type: 'blueprint';
      color: '#2D72D2';
      name: 'cube';
    };
    implements: [];
    interfaceMap: {};
    inverseInterfaceMap: {};
    links: {
      candidates: $ObjectMetadata.Link<OnlineGroup, true>;
      canonical: $ObjectMetadata.Link<OnlineGroup, false>;
      passage: $ObjectMetadata.Link<Passage, false>;
      relationshipsFrom: $ObjectMetadata.Link<Relationship, true>;
      relationshipsTo: $ObjectMetadata.Link<Relationship, true>;
      sourceRecord: $ObjectMetadata.Link<SourceRecord, false>;
    };
    pluralDisplayName: 'Online groups';
    primaryKeyApiName: 'groupId';
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
       *   display name: 'Channels'
       */
      channels: $PropertyDef<'string', 'nullable', 'array'>;
      /**
       *   property status: active
       *
       *   display name: 'Group id'
       */
      groupId: $PropertyDef<'string', 'non-nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Name'
       */
      name: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Passage'
       */
      passageId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Platform'
       */
      platform: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Platform group id'
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
       *   display name: 'Investigation'
       */
      scenario: $PropertyDef<'string', 'nullable', 'single'>;
    };
    rid: 'ri.OnlineGroup';
    status: 'ACTIVE';
    titleProperty: 'name';
    type: 'object';
    visibility: undefined;
  };
}

export const OnlineGroup = {
  type: 'object',
  apiName: 'OnlineGroup',
  osdkMetadata: $osdkMetadata,
  primaryKeyApiName: 'groupId',
  primaryKeyType: 'string',
  internalDoNotUseMetadata: {
    rid: 'ri.OnlineGroup',
  },
} satisfies OnlineGroup & { internalDoNotUseMetadata: { rid: string } } as OnlineGroup;
