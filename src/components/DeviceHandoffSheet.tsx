import React from 'react';
import {
  CheckGlyph,
  CloseGlyph,
  DevicesGlyph,
  NextGlyph,
  PauseGlyph,
  PlayGlyph,
  PrevGlyph,
  TrashGlyph,
} from './AppIcons';
import { PopupSheet } from './PopupSheet';
import {
  RegisteredDevice,
  RemoteCommandType,
  SharedPlaybackState,
  formatDeviceLastSeen,
  getLocalDeviceId,
  isDeviceRecentlyOnline,
} from '../services/deviceHandoff';
import { ShowcaseTrack } from '../types/music';
import { ShowcaseArtwork } from './ShowcaseArtwork';

export interface BrowserAudioOutputOption {
  id: string;
  name: string;
  spec: string;
}

interface DeviceHandoffSheetProps {
  onClose: () => void;
  currentTrack: ShowcaseTrack | null;
  isPlaying: boolean;
  browserOutputs: BrowserAudioOutputOption[];
  activeBrowserOutputId: string;
  onSelectBrowserOutput: (deviceId: string) => void;
  signedInUid: string | null;
  accountDevices: RegisteredDevice[];
  sharedPlayback: SharedPlaybackState | null;
  onClaimHere: () => Promise<void> | void;
  onTransferToDevice: (device: RegisteredDevice) => Promise<void> | void;
  onSendRemoteCommand: (
    targetDeviceId: string,
    command: RemoteCommandType
  ) => Promise<void> | void;
  onRemoveDevice?: (device: RegisteredDevice) => Promise<void> | void;
}

export const DeviceHandoffSheet: React.FC<DeviceHandoffSheetProps> = ({
  onClose,
  currentTrack,
  isPlaying,
  browserOutputs,
  activeBrowserOutputId,
  onSelectBrowserOutput,
  signedInUid,
  accountDevices,
  sharedPlayback,
  onClaimHere,
  onTransferToDevice,
  onSendRemoteCommand,
  onRemoveDevice,
}) => {
  const localDeviceId = getLocalDeviceId(signedInUid);
  const activeRemoteDeviceId = sharedPlayback?.activeDeviceId || localDeviceId;
  const isPlayingRemotely =
    Boolean(signedInUid) &&
    Boolean(sharedPlayback?.activeDeviceId) &&
    sharedPlayback?.activeDeviceId !== localDeviceId;

  const activeBrowserOutputName =
    browserOutputs.find((d) => d.id === activeBrowserOutputId)?.name ??
    'This Device';

  const remoteTrack = sharedPlayback?.track ?? currentTrack;
  const onlineCount = accountDevices.filter(
    (d) => d.id === localDeviceId || isDeviceRecentlyOnline(d)
  ).length;

  return (
    <PopupSheet
      onClose={onClose}
      ariaLabel="Connect to a Device"
      variant="bottom"
      maxWidthClass="max-w-lg"
      maxHeightClass="max-h-[min(84dvh,calc(100dvh-max(1rem,env(safe-area-inset-top))-0.75rem))]"
    >
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/20 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shrink-0">
            <DevicesGlyph className="w-5 h-5" active={true} />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-white truncate">
              Account Devices &amp; Handoff
            </h3>
            <p className="text-xs text-white/75 font-bold truncate mt-0.5">
              {isPlayingRemotely
                ? `Active on ${sharedPlayback?.activeDeviceName || 'Another Device'}`
                : `Active on ${activeBrowserOutputName}`}
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-label="Close devices"
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white shrink-0 transition-colors"
        >
          <CloseGlyph className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-5 flex-1 min-h-0 overflow-y-auto no-scrollbar">
        {/* Remote Active Session Banner + Controls when another device holds playback */}
        {isPlayingRemotely && sharedPlayback && (
          <div className="rounded-2xl bg-[#111114] border border-white/35 p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-white truncate">
                Listening on {sharedPlayback.activeDeviceName}
              </span>
              <button
                type="button"
                onClick={() => void onClaimHere()}
                className="px-3 py-1.5 rounded-full bg-white text-black text-[11px] font-extrabold hover:bg-white/90 active:scale-95 transition-all shrink-0"
              >
                Transfer Here
              </button>
            </div>

            {remoteTrack && (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/20 shrink-0">
                    <ShowcaseArtwork
                      style={remoteTrack.artwork}
                      coverUrl={remoteTrack.coverUrl}
                      alt={remoteTrack.title}
                      compact={true}
                      className="w-full h-full"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-white truncate">
                      {remoteTrack.title}
                    </div>
                    <div className="text-[11px] text-white/75 font-bold truncate">
                      {remoteTrack.artist}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    aria-label="Remote previous"
                    onClick={() =>
                      void onSendRemoteCommand(sharedPlayback.activeDeviceId, 'prev')
                    }
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                  >
                    <PrevGlyph className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={sharedPlayback.isPlaying ? 'Remote pause' : 'Remote play'}
                    onClick={() =>
                      void onSendRemoteCommand(
                        sharedPlayback.activeDeviceId,
                        sharedPlayback.isPlaying ? 'pause' : 'play'
                      )
                    }
                    className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center"
                  >
                    {sharedPlayback.isPlaying ? (
                      <PauseGlyph className="w-4 h-4" />
                    ) : (
                      <PlayGlyph className="w-4 h-4 translate-x-[0.5px]" />
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label="Remote next"
                    onClick={() =>
                      void onSendRemoteCommand(sharedPlayback.activeDeviceId, 'next')
                    }
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                  >
                    <NextGlyph className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Account Synced Devices */}
        {signedInUid ? (
          <div className="space-y-2">
            <div className="px-1 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/75 font-bold">
                Your Account Devices ({accountDevices.length})
              </span>
              <span className="text-[10px] font-semibold text-white/60 tabular-nums">
                {onlineCount} online · Live Sync
              </span>
            </div>

            {accountDevices.length === 0 ? (
              <div className="rounded-2xl bg-[#111114] border border-white/20 px-4 py-3 text-xs text-white/75 font-bold leading-relaxed">
                Registering this device with your Google account… Sign in on another phone, tablet, or browser with the same Google account to sync and hand off playback seamlessly.
              </div>
            ) : (
              accountDevices.map((device) => {
                const isThisDevice = device.id === localDeviceId;
                const isActiveTarget = activeRemoteDeviceId === device.id;
                const isOnline = isThisDevice || isDeviceRecentlyOnline(device);
                const statusLabel = isActiveTarget
                  ? isPlaying || sharedPlayback?.isPlaying
                    ? 'Currently Playing'
                    : 'Active Session'
                  : `${device.platform || 'Web'} · ${formatDeviceLastSeen(
                      device.lastSeenAt
                    )}`;

                return (
                  <div
                    key={device.id}
                    className={`w-full flex items-center justify-between gap-2.5 px-4 py-3 rounded-2xl border transition-all ${
                      isActiveTarget
                        ? 'bg-white text-black border-white'
                        : 'bg-[#111114] text-white border-white/20 hover:border-white/30'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={async () => {
                        if (isThisDevice) {
                          await onClaimHere();
                        } else if (currentTrack || sharedPlayback?.track) {
                          await onTransferToDevice(device);
                        }
                        onClose();
                      }}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left"
                    >
                      <div className="relative shrink-0">
                        <DevicesGlyph
                          className="w-5 h-5"
                          active={isActiveTarget}
                        />
                        {isOnline && (
                          <span
                            aria-hidden="true"
                            className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border ${
                              isActiveTarget
                                ? 'bg-black border-white'
                                : 'bg-white border-[#141416]'
                            }`}
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-extrabold truncate">
                          {device.name} {isThisDevice ? '· This Device' : ''}
                        </div>
                        <div
                          className={`text-xs truncate mt-0.5 ${
                            isActiveTarget ? 'text-black/75' : 'text-white/75 font-bold'
                          }`}
                        >
                          {statusLabel}
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isActiveTarget ? (
                        <span className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center shrink-0">
                          <CheckGlyph className="w-3.5 h-3.5" />
                        </span>
                      ) : currentTrack || sharedPlayback?.track ? (
                        <button
                          type="button"
                          onClick={async () => {
                            await onTransferToDevice(device);
                            onClose();
                          }}
                          className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[10px] font-bold text-white shrink-0 transition-colors"
                        >
                          Transfer
                        </button>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-white/[0.06] text-[10px] font-semibold text-white/70 shrink-0">
                          {isOnline ? 'Online' : 'Synced'}
                        </span>
                      )}

                      {!isThisDevice && onRemoveDevice && (
                        <button
                          type="button"
                          aria-label={`Remove ${device.name}`}
                          onClick={() => void onRemoveDevice(device)}
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                            isActiveTarget
                              ? 'bg-black/10 text-black hover:bg-black/20'
                              : 'bg-white/[0.06] text-white/55 hover:text-white hover:bg-white/15'
                          }`}
                        >
                          <TrashGlyph className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-[#111114] border border-white/20 px-4 py-3 text-xs text-white/75 font-bold">
            Sign in with Google to view your synced Android, iOS, and desktop devices and transfer playback in real time.
          </div>
        )}

        {/* Local Audio Outputs */}
        <div className="space-y-2">
          <div className="px-1 text-[11px] font-bold uppercase tracking-wider text-white/75 font-bold">
            Speaker &amp; Output Routing
          </div>
          {browserOutputs.map((device) => {
            const active = activeBrowserOutputId === device.id;
            return (
              <button
                key={device.id}
                type="button"
                onClick={() => {
                  onSelectBrowserOutput(device.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border text-left transition-all ${
                  active
                    ? 'bg-white text-[#000000] border-white'
                    : 'bg-[#111114] text-white border-white/20 hover:border-white/30'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <DevicesGlyph className="w-4 h-4 shrink-0" active={active} />
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{device.name}</div>
                    <div
                      className={`text-[11px] truncate ${
                        active ? 'text-[#000000]/70' : 'text-white/75 font-bold'
                      }`}
                    >
                      {device.spec}
                    </div>
                  </div>
                </div>
                {active && (
                  <span className="w-6 h-6 rounded-full bg-[#000000] text-white flex items-center justify-center shrink-0">
                    <CheckGlyph className="w-3 h-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </PopupSheet>
  );
};
