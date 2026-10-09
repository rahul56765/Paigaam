import React from 'react';
import { Composition } from 'remotion';
import { Invite, InviteLandscape } from './Invite.jsx';
import { SAMPLE, normalize } from './lib/schema.js';
import { buildTimeline, FPS } from './lib/timeline.js';

const meta = ({ props }) => ({ durationInFrames: buildTimeline(normalize(props.data), FPS).durationInFrames });

export const RemotionRoot = () => (
  <>
    <Composition id="Invite" component={Invite} width={1080} height={1920} fps={FPS} durationInFrames={1738}
      defaultProps={{ data: SAMPLE, assetBase: '' }} calculateMetadata={meta} />
    <Composition id="InviteLandscape" component={InviteLandscape} width={1920} height={1080} fps={FPS} durationInFrames={1738}
      defaultProps={{ data: SAMPLE, assetBase: '' }} calculateMetadata={meta} />
  </>
);
