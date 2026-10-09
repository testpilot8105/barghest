import type { PropertyDef as $PropertyDef } from '@osdk/client';
import { $osdkMetadata } from '../../OntologyMetadata.js';
import type { $ExpectedClientVersion } from '../../OntologyMetadata.js';
import type { DigitalAccount } from './DigitalAccount.js';
import type { School } from './School.js';
import type { Firearm } from './Firearm.js';
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

export namespace Person {
  export type PropertyKeys =
    | 'aliases'
    | 'canonicalId'
    | 'fullName'
    | 'passageId'
    | 'personId'
    | 'photoId'
    | 'recordId'
    | 'role'
    | 'scenario'
    | 'schoolId';

  export interface Links {
    readonly candidates: Person.ObjectSet;
    readonly canonical: $SingleLinkAccessor<Person>;
    readonly digitalAccounts: DigitalAccount.ObjectSet;
    readonly firearmsInCustody: Firearm.ObjectSet;
    readonly firearmsRegistered: Firearm.ObjectSet;
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
     *   display name: 'Aliases'
     */
    readonly aliases: $PropType['string'][] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Canonical object'
     */
    readonly canonicalId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Full name'
     */
    readonly fullName: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Passage'
     */
    readonly passageId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Person id'
     */
    readonly personId: $PropType['string'];
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
     *   display name: 'Role'
     */
    readonly role: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Investigation'
     */
    readonly scenario: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'School'
     */
    readonly schoolId: $PropType['string'] | undefined;
  }
  export type StrictProps = Props;

  export interface ObjectSet extends $ObjectSet<Person, Person.ObjectSet> {}

  export type OsdkInstance<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Person.Props = keyof Person.Props,
  > = $Osdk.Instance<Person, OPTIONS, K>;

  /** @deprecated use OsdkInstance */
  export type OsdkObject<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Person.Props = keyof Person.Props,
  > = OsdkInstance<OPTIONS, K>;
}

export interface Person extends $ObjectTypeDefinition {
  osdkMetadata: typeof $osdkMetadata;
  type: 'object';
  apiName: 'Person';
  primaryKeyApiName: 'personId';
  primaryKeyType: 'string';
  __DefinitionMetadata?: {
    objectSet: Person.ObjectSet;
    props: Person.Props;
    linksType: Person.Links;
    strictProps: Person.StrictProps;
    apiName: 'Person';
    description: undefined;
    displayName: 'Person';
    icon: {
      type: 'blueprint';
      color: '#2D72D2';
      name: 'cube';
    };
    implements: [];
    interfaceMap: {};
    inverseInterfaceMap: {};
    links: {
      candidates: $ObjectMetadata.Link<Person, true>;
      canonical: $ObjectMetadata.Link<Person, false>;
      digitalAccounts: $ObjectMetadata.Link<DigitalAccount, true>;
      firearmsInCustody: $ObjectMetadata.Link<Firearm, true>;
      firearmsRegistered: $ObjectMetadata.Link<Firearm, true>;
      passage: $ObjectMetadata.Link<Passage, false>;
      relationshipsFrom: $ObjectMetadata.Link<Relationship, true>;
      relationshipsTo: $ObjectMetadata.Link<Relationship, true>;
      school: $ObjectMetadata.Link<School, false>;
      sourceRecord: $ObjectMetadata.Link<SourceRecord, false>;
    };
    pluralDisplayName: 'People';
    primaryKeyApiName: 'personId';
    primaryKeyType: 'string';
    properties: {
      /**
       *   property status: active
       *
       *   display name: 'Aliases'
       */
      aliases: $PropertyDef<'string', 'nullable', 'array'>;
      /**
       *   property status: active
       *
       *   display name: 'Canonical object'
       */
      canonicalId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Full name'
       */
      fullName: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Passage'
       */
      passageId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Person id'
       */
      personId: $PropertyDef<'string', 'non-nullable', 'single'>;
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
       *   display name: 'Role'
       */
      role: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Investigation'
       */
      scenario: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'School'
       */
      schoolId: $PropertyDef<'string', 'nullable', 'single'>;
    };
    rid: 'ri.Person';
    status: 'ACTIVE';
    titleProperty: 'fullName';
    type: 'object';
    visibility: undefined;
  };
}

export const Person = {
  type: 'object',
  apiName: 'Person',
  osdkMetadata: $osdkMetadata,
  primaryKeyApiName: 'personId',
  primaryKeyType: 'string',
  internalDoNotUseMetadata: {
    rid: 'ri.Person',
  },
} satisfies Person & { internalDoNotUseMetadata: { rid: string } } as Person;
