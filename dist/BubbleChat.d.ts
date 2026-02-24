/// <reference types="react" />
import type { BubbleProps } from '@growtheffectai/chat-component/dist/features/bubble/components/Bubble';
type Props = BubbleProps;
declare global {
    namespace JSX {
        interface IntrinsicElements {
            'growtheffect-chatbot': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
        }
    }
}
export declare const BubbleChat: (props: Props) => null;
export {};
//# sourceMappingURL=BubbleChat.d.ts.map