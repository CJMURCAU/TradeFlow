import { ReactNode } from 'react';
import { View, StyleSheet, Platform } from 'react-native';

type PhoneFrameProps = {
  children: ReactNode;
  width?: number;
  height?: number;
};

export default function PhoneFrame({ children, width = 280, height = 560 }: PhoneFrameProps) {
  return (
    <View style={[styles.frame, { width, height }]}>
      <View style={styles.notch} />
      <View style={styles.screen}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: '#1B2B4B',
    borderRadius: 36,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    alignSelf: 'center',
  },
  notch: {
    position: 'absolute',
    top: 8,
    left: '50%',
    marginLeft: -40,
    width: 80,
    height: 18,
    backgroundColor: '#0F172A',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    zIndex: 10,
  },
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    overflow: 'hidden',
  },
});
