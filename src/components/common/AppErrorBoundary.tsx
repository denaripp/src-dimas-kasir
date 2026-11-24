import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { MotionPressable } from '@/components/common/MotionPressable';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Terjadi kesalahan tidak terduga.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('AppErrorBoundary caught error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 items-center justify-center bg-white px-6">
          <View className="w-full rounded-hero border border-border bg-white p-5">
            <View className="mb-3.5 h-12 w-12 items-center justify-center rounded-2xl bg-red-soft">
              <FontAwesome6 name="triangle-exclamation" size={18} color="#D91E2A" solid />
            </View>
            <Text className="font-extrabold text-[17px] text-black">
              Terjadi Gangguan Layar
            </Text>
            <Text className="mt-1.5 font-medium text-[12.5px] leading-5 text-muted">
              {this.state.errorMessage}
            </Text>
            <MotionPressable
              onPress={this.handleReset}
              className="mt-5 min-h-[46px] items-center justify-center rounded-control bg-red py-3"
            >
              <Text className="font-extrabold text-[13.5px] text-white">Muat Ulang</Text>
            </MotionPressable>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}
