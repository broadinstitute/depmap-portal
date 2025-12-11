import React from "react";
import { Button } from "react-bootstrap";
import styles from "../../../../../styles/GeneTea.scss";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalMatchingGenes: number;
  pageSize: number;
  isLoading: boolean;
  handleNextPage: () => void;
  handlePrevPage: () => void;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  totalMatchingGenes,
  pageSize,
  isLoading,
  handleNextPage,
  handlePrevPage,
}) => {
  if (totalMatchingGenes <= pageSize) {
    return null; // Don't show controls if content fits on one page
  }

  const startGene = Math.min(currentPage * pageSize + 1, totalMatchingGenes);
  const endGene = Math.min((currentPage + 1) * pageSize, totalMatchingGenes);

  return (
    <div className={styles.paginationControls}>
      <Button
        onClick={handlePrevPage}
        disabled={currentPage === 0 || isLoading}
        bsSize="small"
        className={styles.paginationPrevButton}
      >
        Previous Page
      </Button>
      <span>
        Page {currentPage + 1} of {totalPages}
      </span>
      <Button
        onClick={handleNextPage}
        disabled={currentPage === totalPages - 1 || isLoading}
        bsSize="small"
        className={styles.paginationNextButton}
      >
        Next Page
      </Button>
      <p className={styles.pageCountLabel}>
        Displaying genes {startGene} to {endGene}
      </p>
    </div>
  );
};

export default PaginationControls;
