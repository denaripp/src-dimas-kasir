import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

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
          <View className="w-full rounded-hero border-[1.5px] border-black bg-white p-5">
            <View className="mb-3 h-12 w-12 items-center justify-center rounded-full bg-red">
              <FontAwesome6 name="triangle-exclamation" size={18} color="#FFFFFF" solid />
            </View>
            <Text className="font-extrabold text-[17px] text-black">
              Terjadi Gangguan Layar
            </Text>
            <Text className="mt-1.5 font-medium text-[12.5px] text-black">
              {this.state.errorMessage}
            </Text>
            <Pressable
              onPress={this.handleReset}
              className="mt-4 items-center rounded-control bg-red py-3.5"
            >
              <Text className="font-extrabold text-[13.5px] text-white">Muat Ulang</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}
