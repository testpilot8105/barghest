import type { PropertyDef as $PropertyDef } from '@osdk/client';
import { $osdkMetadata } from '../../OntologyMetadata.js';
import type { $ExpectedClientVersion } from '../../OntologyMetadata.js';
import type { Person } from './Person.js';
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

export namespace School {
  export type PropertyKeys =
    | 'canonicalId'
    | 'depedId'
    | 'division'
    | 'name'
    | 'passageId'
    | 'recordId'
    | 'scenario'
    | 'schoolId';

  export interface Links {
    readonly candidates: School.ObjectSet;
    readonly canonical: $SingleLinkAccessor<School>;
    readonly incidents: Incident.ObjectSet;
    readonly passage: $SingleLinkAccessor<Passage>;
    readonly people: Person.ObjectSet;
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
     *   display name: 'DepEd school id'
     */
    readonly depedId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Division'
     */
    readonly division: $PropType['string'] | undefined;
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
     *   display name: 'School id'
     */
    readonly schoolId: $PropType['string'];
  }
  export type StrictProps = Props;

  export interface ObjectSet extends $ObjectSet<School, School.ObjectSet> {}

  export type OsdkInstance<
    OPTIONS extends never | '$rid' = never,
    K extends keyof School.Props = keyof School.Props,
  > = $Osdk.Instance<School, OPTIONS, K>;

  /** @deprecated use OsdkInstance */
  export type OsdkObject<
    OPTIONS extends never | '$rid' = never,
    K extends keyof School.Props = keyof School.Props,
  > = OsdkInstance<OPTIONS, K>;
}

export interface School extends $ObjectTypeDefinition {
  osdkMetadata: typeof $osdkMetadata;
  type: 'object';
  apiName: 'School';
  primaryKeyApiName: 'schoolId';
  primaryKeyType: 'string';
  __DefinitionMetadata?: {
    objectSet: School.ObjectSet;
    props: School.Props;
    linksType: School.Links;
    strictProps: School.StrictProps;
    apiName: 'School';
    description: undefined;
    displayName: 'School';
    icon: {
      type: 'blueprint';
      color: '#2D72D2';
      name: 'cube';
    };
    implements: [];
    interfaceMap: {};
    inverseInterfaceMap: {};
    links: {
      candidates: $ObjectMetadata.Link<School, true>;
      canonical: $ObjectMetadata.Link<School, false>;
      incidents: $ObjectMetadata.Link<Incident, true>;
      passage: $ObjectMetadata.Link<Passage, false>;
      people: $ObjectMetadata.Link<Person, true>;
      relationshipsFrom: $ObjectMetadata.Link<Relationship, true>;
      relationshipsTo: $ObjectMetadata.Link<Relationship, true>;
      sourceRecord: $ObjectMetadata.Link<SourceRecord, false>;
    };
    pluralDisplayName: 'Schools';
    primaryKeyApiName: 'schoolId';
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
       *   display name: 'DepEd school id'
       */
      depedId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Division'
       */
      division: $PropertyDef<'string', 'nullable', 'single'>;
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
       *   display name: 'School id'
       */
      schoolId: $PropertyDef<'string', 'non-nullable', 'single'>;
    };
    rid: 'ri.School';
    status: 'ACTIVE';
    titleProperty: 'name';
    type: 'object';
    visibility: undefined;
  };
}

export const School = {
  type: 'object',
  apiName: 'School',
  osdkMetadata: $osdkMetadata,
  primaryKeyApiName: 'schoolId',
  primaryKeyType: 'string',
  internalDoNotUseMetadata: {
    rid: 'ri.School',
  },
} satisfies School & { internalDoNotUseMetadata: { rid: string } } as School;
