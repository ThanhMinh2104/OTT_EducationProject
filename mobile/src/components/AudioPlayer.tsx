import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Audio } from 'expo-av';

interface Props {
  audioUrl: string;
  isMine: boolean;
}

const AudioPlayer = ({ audioUrl, isMine }: Props) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const loadAndPlay = async () => {
    try {
      if (sound) {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          if (isPlaying) {
            await sound.pauseAsync();
            setIsPlaying(false);
          } else {
            await sound.playAsync();
            setIsPlaying(true);
          }
          return;
        }
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
      setIsPlaying(true);
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setDuration(status.durationMillis || 0);
      setPosition(status.positionMillis || 0);
      
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
      }
    }
  };

  const formatTime = (millis: number) => {
    const seconds = Math.floor(millis / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <View style={[styles.container, isMine ? styles.containerMine : styles.containerOther]}>
      <TouchableOpacity onPress={loadAndPlay} style={styles.playButton}>
        <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶️'}</Text>
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
        {formatTime(duration)}
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
