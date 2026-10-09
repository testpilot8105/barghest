// The first screen of a site: a hero with the headline, the one-liner and one call to action, on Blueprint as
// shipped. Replace it with the real thing. Every control is a Blueprint component imported straight from
// @blueprintjs/* (AGENTS.md § Stack law); raw tags carry layout only, styled in src/site.css.
import { Button, Classes, H1 } from '@blueprintjs/core';

export function Home() {
  return (
    <main className="home">
      <H1>BARGHEST</H1>
      <p className={Classes.TEXT_LARGE}>Local-AI intelligence workbench</p>
      <Button intent="primary" size="large" text="Get started" />
    </main>
  );
}
