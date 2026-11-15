#!/usr/bin/env bash
#
# Fails when two ADRs share a numeric prefix (docs/adr/NNNN-*.md).
#
# Parallel worktrees each pick the next free number, so two branches can add
# the same one. CI runs this on the PR's merge with main, so whichever branch
# arrives second has to renumber its ADR before merging.
#
# Usage: scripts/check-adr-numbers.sh [dir]   (default: docs/adr)

set -euo pipefail

dir="${1:-docs/adr}"
if [[ ! -d "$dir" ]]; then
  echo "::error::$dir is not a directory, so its ADR numbers cannot be checked."
  exit 1
fi

shopt -s nullglob
declare -A files_by_number=()
for path in "$dir"/[0-9]*-*.md; do
  name="${path##*/}"
  number="${name%%-*}"
  files_by_number[$number]+="${files_by_number[$number]:+, }$name"
done

status=0
for number in $(printf '%s\n' "${!files_by_number[@]}" | sort); do
  if [[ "${files_by_number[$number]}" == *", "* ]]; then
    echo "::error::ADR number $number is used by more than one file: ${files_by_number[$number]}. Renumber the newer one."
    status=1
  fi
done

if [[ $status -eq 0 ]]; then
  echo "Every ADR in $dir has its own number."
fi
exit $status
