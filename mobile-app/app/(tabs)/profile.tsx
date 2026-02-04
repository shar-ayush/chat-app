import { View, Text, Pressable, } from 'react-native'

import React from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@clerk/clerk-expo'

const profile = () => {
  const {signOut} = useAuth();
  return (
    <SafeAreaView className='bg-surface flex-1'>
      <Text className='text-white'>profile</Text>
      <Pressable 
      onPress={() => signOut()}
      className='mt-4 bg-red-600 px-4 py-2 rounded-lg'>
        <Text>Sign out</Text>
      </Pressable>
    </SafeAreaView>
  )
}

export default profile