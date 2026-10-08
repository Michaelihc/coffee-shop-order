export default defineAppConfig({
  pages: ["pages/menu/index", "pages/cart/index", "pages/orders/index"],
  window: {
    navigationBarTitleText: "Coffee Shop",
    navigationBarBackgroundColor: "#f6f0e7",
    navigationBarTextStyle: "black",
    backgroundColor: "#f6f0e7",
  },
  tabBar: {
    color: "#7b6a58",
    selectedColor: "#8b5e3c",
    backgroundColor: "#fff8ef",
    list: [
      {
        pagePath: "pages/menu/index",
        text: "Menu",
      },
      {
        pagePath: "pages/cart/index",
        text: "Cart",
      },
      {
        pagePath: "pages/orders/index",
        text: "Orders",
      },
    ],
  },
});
