import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';

interface Props {
  audioUrl: string;
  isMine: boolean;
}

const AudioPlayer = ({ audioUrl, isMine }: Props) => {
  const player = useAudioPlayer(audioUrl);
  const status = useAudioPlayerStatus(player);

  // Set audio mode khi component mount
  useEffect(() => {
    const setupAudio = async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true, // Phát cả khi silent mode (iOS)
          allowsRecording: false,
        });
        console.log('✅ Audio mode set for playback');
      } catch (err) {
        console.error('❌ Error setting audio mode:', err);
      }
    };
    setupAudio();
  }, []);

  // Debug audio status
  useEffect(() => {
    console.log('🎵 Audio status:', {
      url: audioUrl,
      playing: player.playing,
      currentTime: status.currentTime,
      duration: status.duration,
      isLoaded: status.isLoaded,
    });
  }, [player.playing, status.duration]);

  const togglePlayPause = () => {
    try {
      console.log('🎵 Toggle play/pause, currently:', player.playing ? 'playing' : 'paused');
      if (player.playing) {
        player.pause();
      } else {
        player.play();
      }
    } catch (err) {
      console.error('❌ Error toggling playback:', err);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = status.duration > 0 ? (status.currentTime / status.duration) * 100 : 0;

  return (
    <View style={[styles.container, isMine ? styles.containerMine : styles.containerOther]}>
      <TouchableOpacity onPress={togglePlayPause} style={styles.playButton}>
        <Text style={styles.playIcon}>{player.playing ? '⏸' : '▶️'}</Text>
      </TouchableOpacity>

      {/* Waveform bars */}
      <View style={styles.waveform}>
        {[20, 35, 50, 40, 55, 30, 45, 38, 52, 28].map((height, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: `${progress > (i / 10) * 100 ? height : height * 0.4}%`,
                backgroundColor: isMine ? 'rgba(255,255,255,0.8)' : '#0e9de8',
                opacity: progress > (i / 10) * 100 ? 1 : 0.5,
              },
            ]}
          />
        ))}
      </View>

      <Text style={[styles.duration, isMine && styles.durationMine]}>
        {formatTime(status.duration)}
      </Text>

      <TouchableOpacity onPress={() => {}} style={styles.downloadButton}>
        <Text style={[styles.downloadIcon, isMine && styles.downloadIconMine]}>⬇️</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    minWidth: 220,
    maxWidth: 280,
  },
  containerMine: {
    backgroundColor: '#0e9de8',
  },
  containerOther: {
    backgroundColor: '#2c3e50',
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  playIcon: {
    fontSize: 16,
  },
  waveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    gap: 2,
  },
  bar: {
    width: 3,
    borderRadius: 2,
  },
  duration: {
    fontSize: 11,
    color: '#fff',
    marginLeft: 8,
    fontWeight: '600',
  },
  durationMine: {
    color: '#fff',
  },
  downloadButton: {
    marginLeft: 8,
    padding: 4,
  },
  downloadIcon: {
    fontSize: 16,
    opacity: 0.8,
  },
  downloadIconMine: {
    opacity: 1,
  },
});

export default AudioPlayer;
