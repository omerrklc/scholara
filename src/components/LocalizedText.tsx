import { Children, ReactNode } from 'react';
import { Text as NativeText, type TextProps } from 'react-native';
import { useI18n } from '@/i18n';

const translateChildren = (node: ReactNode, translate: (source: string) => string): ReactNode => {
  if (typeof node === 'string') return translate(node);
  if (Array.isArray(node)) return Children.map(node, (child) => translateChildren(child, translate));
  return node;
};

export function Text({ children, translate = true, ...props }: TextProps & { translate?: boolean }) {
  const { t } = useI18n();
  return <NativeText {...props}>{translate ? translateChildren(children, t) : children}</NativeText>;
}
