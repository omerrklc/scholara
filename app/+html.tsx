import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
      <ScrollViewStyleReset />
      <style dangerouslySetInnerHTML={{ __html: '*{box-sizing:border-box}html,body,#root{width:100%;min-height:100%;margin:0;overflow-x:hidden}' }} />
    </head>
    <body>{children}</body>
  </html>;
}
