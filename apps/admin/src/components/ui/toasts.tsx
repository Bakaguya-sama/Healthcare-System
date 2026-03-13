import { ToastContainer, toast } from "react-toastify";

const defaultOptions = {
  position: "top-right",
  autoClose: 3000,
  hideProgressBar: true,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: false,

  style: {
    width: "360px",
    height: "80px",
  },
};

const ToastMessage = (title: string, message: string) => {
  return (
    <div>
      <strong>{title}</strong>
      <div>{message}</div>
    </div>
  );
};

export const showToast = {
  success: (message, options = {}) =>
    toast.success(ToastMessage("Success", message), {
      ...defaultOptions,
      ...options,
    }),

  error: (message, options = {}) =>
    toast.error(ToastMessage("Error", message), {
      ...defaultOptions,
      ...options,
    }),

  //   info: (message, options = {}) =>
  //     toast.info(message, { ...defaultOptions, ...options }),

  //   warning: (message, options = {}) =>
  //     toast.warning(message, { ...defaultOptions, ...options }),

  //   custom: (message, options = {}) =>
  //     toast(message, { ...defaultOptions, ...options }),
};
