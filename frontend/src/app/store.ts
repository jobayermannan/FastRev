import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '../api/baseApi';
import authReducer from '../features/auth/authSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefault) => getDefault().concat(baseApi.middleware),
});

// Signing out must not leave the previous user's cached patients and appointments behind.
store.subscribe(() => {
  if (!store.getState().auth.token && Object.keys(store.getState().api.queries).length) {
    store.dispatch(baseApi.util.resetApiState());
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
