// Generated from vendor/wordgard/src/command/menu.ts; MIT license: vendor/wordgard/LICENSE.
// Regenerate with npm run types:wordgard; do not edit.
import { type Wordgard } from "wordgard-vendor/editor/index";
import { Command } from "./command";
import { GardState, Transaction } from "wordgard-vendor/state/index";
import { PhraseSet } from "wordgard-vendor/phrases/index";
import { Mark } from "wordgard-vendor/doc/index";
export declare namespace Menu {
    type Item = Group | Submenu | Button | CustomControl;
    namespace Item {
        interface Spec {
            select?: (state: GardState) => boolean;
            enable?: (state: GardState) => boolean;
            updateFor?: (tr: Transaction) => boolean;
            parent?: Group | Submenu;
            rank?: number;
            description?: PhraseSet.Ref | string;
        }
        class Base {
            select: ((state: GardState) => boolean) | undefined;
            enable: ((state: GardState) => boolean) | undefined;
            updateFor: ((tr: Transaction) => boolean) | undefined;
            parent: Group | Submenu | undefined;
            rank: number;
            description: PhraseSet.Ref | string | undefined;
            extension: GardState.Extension;
            constructor(spec: Item.Spec);
        }
        const source: GardState.Facet<Item, readonly Item[]>;
        type Resolved = Button | CustomControl | "|" | Submenu.Resolved;
    }
    type Label = string | PhraseSet.Ref | {
        icon: string;
        directional?: boolean;
    };
    class Button extends Item.Base {
        readonly spec: Button.Spec;
        label: Label;
        run: Command.Bound | Command;
        active: ((state: GardState) => boolean) | undefined;
        private constructor();
        static define(spec: Button.Spec): Button;
    }
    namespace Button {
        interface Spec extends Item.Spec {
            run: Command.Bound | Command;
            active?: (state: GardState) => boolean;
            label: Label;
        }
        function toggleMark(config: {
            mark: Mark;
            parent?: Menu.Group | Menu.Submenu;
            rank?: number;
            description?: PhraseSet.Ref;
            label: Menu.Label;
        }): Button;
    }
    class CustomControl extends Item.Base {
        readonly spec: CustomControl.Spec;
        render: (wg: Wordgard, done: () => void) => {
            dom: HTMLElement;
            focus?: HTMLElement;
        };
        setEnabled: ((dom: Element, enabled: boolean) => void) | undefined;
        private constructor();
        static define(spec: CustomControl.Spec): CustomControl;
    }
    namespace CustomControl {
        interface Spec extends Item.Spec {
            render: (wg: Wordgard, done: () => void) => {
                dom: HTMLElement;
                focus?: HTMLElement;
            };
            setEnabled?: (focus: Element, enabled: boolean) => void;
        }
    }
    class Group {
        readonly spec: Group.Spec;
        margin: boolean;
        parent: Group | Submenu | undefined;
        rank: number;
        content: readonly (Item | "...")[] | undefined;
        overflow: {
            at: number;
            wrap?: Submenu;
        } | undefined;
        extension: GardState.Extension;
        private constructor();
        static define(spec?: Group.Spec): Group;
        template(...content: (Template | Item | "...")[]): Template;
    }
    namespace Group {
        interface Spec {
            margin?: boolean;
            parent?: Group | Submenu;
            rank?: number;
            content?: readonly (Item | "...")[];
            overflow?: {
                at: number;
                wrap?: Submenu;
            };
        }
        const top: Group;
        const commands: Group;
        const inline: Group;
        const block: Group;
        const insert: Group;
    }
    class Submenu extends Item.Base {
        readonly spec: Submenu.Spec;
        label: Label | undefined;
        defaultLabel: Label | undefined;
        arrow: boolean;
        width: number | undefined;
        content: readonly (Item | "...")[] | undefined;
        private constructor();
        static define(spec: Submenu.Spec): Submenu;
        template(...content: (Template | Item | "...")[]): Template;
    }
    namespace Submenu {
        interface Spec extends Item.Spec {
            label?: Label;
            defaultLabel?: Label;
            arrow?: boolean;
            width?: number;
            content?: readonly (Item | "...")[];
        }
        class Resolved {
            readonly item: Submenu;
            readonly content: readonly Item.Resolved[];
            private constructor();
            static new(item: Submenu, content: readonly Item.Resolved[]): Resolved;
        }
        const textblockStyle: Submenu;
    }
    class Template {
        readonly item: Group | Submenu;
        readonly content: readonly (Template | Item | "...")[];
        parent: Group | Submenu | null;
        rank: number;
        private tag;
        private constructor();
        static new(item: Group | Submenu, content?: readonly (Template | Item | "...")[]): Template;
    }
    function resolve(items: readonly Item[], template?: Template | readonly Template[], suppress?: readonly Item[]): readonly Item.Resolved[];
}
