import { Box, CssBaseline } from "@mui/material";
import CustomAppBar from "./appbar";
import { ReactNode } from "react";
import CustomDrawer from "./drawer";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: "flex" }}>
      {/* <CssBaseline /> */}
      <CustomAppBar />
      <CustomDrawer />
      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, width: "100%", height: "100%", mt: "64px" }}
      >
        {children}
      </Box>
    </Box>
  );
}
