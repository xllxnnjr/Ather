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
    browserOutputs.find((d) => d.id === activeBrowserOutputId)?.name.toLowerCase() ??
    'this device';

  const remoteTrack = sharedPlayback?.track ?? currentTrack;
  const onlineCount = accountDevices.filter(
    (d) => d.id === localDeviceId || isDeviceRecentlyOnline(d)
  ).length;

  return (
    <PopupSheet
      onClose={onClose}
      ariaLabel="active devices"
      variant="bottom"
      maxWidthClass="max-w-lg"
      maxHeightClass="max-h-[min(84dvh,calc(100dvh-max(1rem,env(safe-area-inset-top))-0.75rem))]"
    >
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#242429] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="ather-acid-btn w-10 h-10 rounded-full flex items-center justify-center shrink-0">
            <DevicesGlyph className="w-5 h-5" active={true} />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-white truncate">
              active devices
            </h3>
            <p className="text-xs text-[#A1A1AA] font-bold truncate mt-0.5">
              {isPlayingRemotely
                ? `active on ${(sharedPlayback?.activeDeviceName || 'another device').toLowerCase()}`
                : `active on ${activeBrowserOutputName}`}
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-label="close devices"
          onClick={onClose}
          className="ather-depth-btn w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0 transition-colors"
        >
          <CloseGlyph className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-5 flex-1 min-h-0 overflow-y-auto no-scrollbar">
        {/* Remote Active Session Banner + Controls when another device holds playback */}
        {isPlayingRemotely && sharedPlayback && (
          <div className="ather-depth-card rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold tracking-wide text-white truncate">
                listening on {sharedPlayback.activeDeviceName.toLowerCase()}
              </span>
              <span className="text-[10px] font-bold text-[#A1A1AA] shrink-0">
                tap a device below to play
              </span>
            </div>

            {remoteTrack && (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#242429] shrink-0">
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
                      {remoteTrack.title.toLowerCase()}
                    </div>
                    <div className="text-[11px] text-[#A1A1AA] font-bold truncate">
                      {remoteTrack.artist.toLowerCase()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    aria-label="remote previous"
                    onClick={() =>
                      void onSendRemoteCommand(sharedPlayback.activeDeviceId, 'prev')
                    }
                    className="ather-depth-btn w-9 h-9 rounded-full text-white flex items-center justify-center"
                  >
                    <PrevGlyph className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={sharedPlayback.isPlaying ? 'remote pause' : 'remote play'}
                    onClick={() =>
                      void onSendRemoteCommand(
                        sharedPlayback.activeDeviceId,
                        sharedPlayback.isPlaying ? 'pause' : 'play'
                      )
                    }
                    className="ather-acid-btn w-10 h-10 rounded-full flex items-center justify-center"
                  >
                    {sharedPlayback.isPlaying ? (
                      <PauseGlyph className="w-4 h-4" />
                    ) : (
                      <PlayGlyph className="w-4 h-4 translate-x-[0.5px]" />
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label="remote next"
                    onClick={() =>
                      void onSendRemoteCommand(sharedPlayback.activeDeviceId, 'next')
                    }
                    className="ather-depth-btn w-9 h-9 rounded-full text-white flex items-center justify-center"
                  >
                    <NextGlyph className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Active Account Devices */}
        {signedInUid ? (
          <div className="space-y-2">
            <div className="px-1 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold tracking-wide text-[#A1A1AA]">
                active devices ({accountDevices.length})
              </span>
              <span className="text-[10px] font-semibold text-white tabular-nums">
                {onlineCount} online · live sync
              </span>
            </div>

            {accountDevices.length === 0 ? (
              <div className="ather-depth-row rounded-2xl px-4 py-3 text-xs text-[#A1A1AA] font-bold leading-relaxed">
                registering this device with your google account… sign in on another phone, tablet, or browser with the same google account to play from any active device.
              </div>
            ) : (
              <div className="space-y-2">
                {accountDevices.map((device) => {
                  const isThisDevice = device.id === localDeviceId;
                  const isActiveTarget = activeRemoteDeviceId === device.id;
                  const isOnline = isThisDevice || isDeviceRecentlyOnline(device);
                  const statusLabel = isActiveTarget
                    ? isPlaying || sharedPlayback?.isPlaying
                      ? 'currently playing'
                      : 'active device'
                    : `${(device.platform || 'web').toLowerCase()} · ${formatDeviceLastSeen(
                        device.lastSeenAt
                      ).toLowerCase()}`;

                  return (
                    <div
                      key={device.id}
                      className={`w-full flex items-center justify-between gap-2.5 px-4 py-3 rounded-2xl transition-all ${
                        isActiveTarget
                          ? 'ather-acid-btn'
                          : 'ather-depth-row text-white'
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
                              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[#242429] ${
                                isActiveTarget ? 'bg-black' : 'bg-white'
                              }`}
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-extrabold truncate">
                            {device.name.toLowerCase()} {isThisDevice ? '· this device' : ''}
                          </div>
                          <div
                            className={`text-xs truncate mt-0.5 ${
                              isActiveTarget ? 'text-black/80 font-bold' : 'text-[#A1A1AA] font-bold'
                            }`}
                          >
                            {statusLabel}
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isActiveTarget ? (
                          <span className="w-7 h-7 rounded-full bg-black text-white border border-[#242429] flex items-center justify-center shrink-0">
                            <CheckGlyph className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-[#141418] border border-[#242429] text-[10px] font-bold text-[#A1A1AA] shrink-0">
                            {isOnline ? 'online' : 'synced'}
                          </span>
                        )}

                        {!isThisDevice && onRemoveDevice && (
                          <button
                            type="button"
                            aria-label={`remove ${device.name.toLowerCase()}`}
                            onClick={() => void onRemoveDevice(device)}
                            className={`w-7 h-7 rounded-full flex items-center justify-center border transition-colors ${
                              isActiveTarget
                                ? 'bg-black/15 text-black border-[#242429]'
                                : 'bg-[#141418] text-[#A1A1AA] hover:text-white border-[#242429]'
                            }`}
                          >
                            <TrashGlyph className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="ather-depth-row rounded-2xl px-4 py-3 text-xs text-[#A1A1AA] font-bold">
            sign in with google to view your active android, ios, and web devices and select where to play.
          </div>
        )}

        {/* Local Audio Outputs */}
        <div className="space-y-2">
          <div className="px-1 text-[11px] font-bold tracking-wide text-[#A1A1AA]">
            speaker &amp; output routing
          </div>
          <div className="space-y-1.5">
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
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-left transition-all ${
                    active
                      ? 'ather-acid-btn'
                      : 'ather-depth-row text-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <DevicesGlyph className="w-4 h-4 shrink-0" active={active} />
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">
                        {device.name.toLowerCase()}
                      </div>
                      <div
                        className={`text-[11px] truncate ${
                          active ? 'text-black/80 font-bold' : 'text-[#A1A1AA] font-bold'
                        }`}
                      >
                        {device.spec.toLowerCase()}
                      </div>
                    </div>
                  </div>
                  {active && (
                    <span className="w-6 h-6 rounded-full bg-black text-white border border-[#242429] flex items-center justify-center shrink-0">
                      <CheckGlyph className="w-3 h-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </PopupSheet>
  );
};
