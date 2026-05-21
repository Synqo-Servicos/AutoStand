import { StyleSheet } from "@react-pdf/renderer";

/**
 * Estilos compartilhados entre todos os templates de documento.
 * Helvetica (built-in do react-pdf) cobre os caracteres acentuados do português.
 */
export const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10.5,
    color: "#0B1F33",
    lineHeight: 1.45,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 12,
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerLeft: {
    flexDirection: "column",
  },
  brandName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#0B1F33",
  },
  brandMeta: {
    fontSize: 9,
    color: "#6B7280",
    marginTop: 2,
  },
  accentBar: {
    height: 3,
    width: 56,
    backgroundColor: "#FF6A1A",
    marginTop: 6,
  },
  documentTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#0B1F33",
    textAlign: "center",
    marginBottom: 18,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#0B1F33",
    marginTop: 12,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  partyBlock: {
    backgroundColor: "#F9FAFB",
    padding: 10,
    borderRadius: 4,
    marginBottom: 8,
  },
  partyLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  paragraph: {
    marginBottom: 8,
    textAlign: "justify",
  },
  clauseTitle: {
    fontFamily: "Helvetica-Bold",
    marginTop: 8,
    marginBottom: 4,
  },
  table: {
    flexDirection: "column",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 4,
    marginVertical: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tableRowLast: {
    flexDirection: "row",
  },
  tableLabel: {
    width: "32%",
    padding: 6,
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
    color: "#6B7280",
    backgroundColor: "#F9FAFB",
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },
  tableValue: {
    flex: 1,
    padding: 6,
    fontSize: 10,
  },
  signatures: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 50,
  },
  signatureBlock: {
    width: "45%",
    alignItems: "center",
  },
  signatureLine: {
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "#0B1F33",
    paddingTop: 4,
  },
  signatureName: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  signatureRole: {
    fontSize: 8.5,
    color: "#6B7280",
    textAlign: "center",
  },
  smallNote: {
    fontSize: 8.5,
    color: "#6B7280",
    marginTop: 4,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#9CA3AF",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 6,
  },
  bold: { fontFamily: "Helvetica-Bold" },
});
